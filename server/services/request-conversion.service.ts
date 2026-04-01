/**
 * RequestConversionService
 *
 * Owns the two conversion use cases:
 *   - Request → Estimate  (toEstimate)
 *   - Request → Job       (toJob)
 *
 * Invariants enforced here:
 *   - A request may be converted exactly once.
 *   - Only requests in status 'new' or 'assessment_scheduled' are eligible.
 *   - 'archived' and 'converted' requests are rejected with the correct HTTP code.
 *   - The entire conversion (create entity + update request status) is atomic.
 *   - The request row is locked with SELECT FOR UPDATE to prevent concurrent
 *     duplicate conversions of the same request.
 *
 * Job number note:
 *   The request row lock serializes conversions on a specific request.
 *   It does NOT prevent two different requests from being converted concurrently
 *   and colliding on job_number. UNIQUE(jobs_job_number_unique) is the active
 *   collision guard for that case. A dedicated global numbering refactor is still
 *   required and is explicitly deferred.
 */

import { eq } from "drizzle-orm";
import type { Server as SocketServer } from "socket.io";
import { db } from "../db";
import { requests, estimates, jobs } from "@shared/schema";
import { numberingService } from "./numbering.service";
import type {
  Estimate,
  Job,
  Request as ServiceRequest,
} from "@shared/schema";

// ─── Error ────────────────────────────────────────────────────────────────────

export class ConversionError extends Error {
  constructor(
    message: string,
    public readonly statusCode: 404 | 409 | 422 | 500,
  ) {
    super(message);
    this.name = "ConversionError";
  }
}

// ─── Postgres error codes ─────────────────────────────────────────────────────

const PG_UNIQUE_VIOLATION = "23505";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ConversionParams {
  requestId: number;
  /** ID of the dispatcher initiating the conversion — used for post-commit events. */
  performedBy: number;
  io?: SocketServer;
}

/**
 * Internal result type. Route handlers expose only `entity` to the client.
 * The full shape is available for future endpoints or admin flows.
 */
export interface ConversionResult<T extends Estimate | Job> {
  request: ServiceRequest;
  entity: T;
  entityType: "estimate" | "job";
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function validateLocked(req: ServiceRequest | undefined, requestId: number): void {
  if (!req) {
    throw new ConversionError("Request not found.", 404);
  }
  if (req.status === "converted") {
    throw new ConversionError("Request is already converted.", 409);
  }
  if (req.status === "closed") {
    throw new ConversionError("Cannot convert a closed request.", 422);
  }
  if (req.status === "archived") {
    throw new ConversionError("Cannot convert an archived request.", 422);
  }
  if (req.status !== "new" && req.status !== "triaged" && req.status !== "assessment_scheduled") {
    throw new ConversionError(
      `Request status '${req.status}' is not eligible for conversion.`,
      422,
    );
  }
  if (req.customerId === null || req.customerId === undefined) {
    throw new ConversionError(
      "Request has no associated customer and cannot be converted.",
      422,
    );
  }
  if (req.serviceAddressId === null || req.serviceAddressId === undefined) {
    throw new ConversionError(
      "Request has no service address. Set a service address before converting.",
      422,
    );
  }
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const requestConversionService = {

  /**
   * Converts a request to a draft estimate.
   *
   * Transaction steps:
   *   1. Lock request row FOR UPDATE
   *   2. Validate state
   *   3. INSERT estimate (requestId, customerId, title, notes, empty line items)
   *   4. UPDATE request status → converted
   *   5. Commit
   *   6. Emit request:converted to staff:notifications
   */
  async toEstimate(params: ConversionParams): Promise<ConversionResult<Estimate>> {
    const { requestId, performedBy, io } = params;

    let committedRequest!: ServiceRequest;
    let committedEstimate!: Estimate;

    await db.transaction(async (tx) => {
      const txDb = tx as unknown as typeof db;

      // 1. Lock — serializes concurrent conversions of THIS request
      const lockedRows = await txDb
        .select()
        .from(requests)
        .where(eq(requests.id, requestId))
        .for("update");

      const req = lockedRows[0] as ServiceRequest | undefined;

      // 2. Validate inside the lock
      validateLocked(req, requestId);

      // 3. Create estimate
      const [est] = await txDb
        .insert(estimates)
        .values({
          customerId: req!.customerId!,
          requestId:  req!.id,
          title:      req!.title,
          status:     "draft",
          notes:      req!.clientNotes ?? null,
          lineItems:  [],
          subtotal:   "0",
          tax:        "0",
          total:      "0",
        })
        .returning();
      committedEstimate = est;

      // 4. Mark request converted + record conversion metadata
      const [updated] = await txDb
        .update(requests)
        .set({
          status:           "converted",
          convertedToType:  "estimate",
          convertedAt:      new Date(),
          convertedByUserId: params.performedBy,
        })
        .where(eq(requests.id, requestId))
        .returning();
      committedRequest = updated as ServiceRequest;
    });

    // 5. Post-commit socket event
    if (io) {
      io.to("staff:notifications").emit("request:converted", {
        requestId,
        entityType:  "estimate",
        entityId:    committedEstimate.id,
        performedBy,
      });
    }

    return { request: committedRequest, entity: committedEstimate, entityType: "estimate" };
  },

  /**
   * Converts a request to a pending job.
   *
   * Transaction steps:
   *   1. Lock request row FOR UPDATE
   *   2. Validate state
   *   3. Compute next job number (MAX query — see numbering note in file header)
   *   4. INSERT job (requestId, customerId, title, notes, jobNumber, status=pending)
   *   5. UPDATE request status → converted
   *   6. Commit
   *   7. Emit request:converted to staff:notifications
   *
   * On unique constraint violation for job_number: surfaces as retryable HTTP 500.
   */
  async toJob(params: ConversionParams): Promise<ConversionResult<Job>> {
    const { requestId, performedBy, io } = params;

    let committedRequest!: ServiceRequest;
    let committedJob!: Job;

    try {
      await db.transaction(async (tx) => {
        const txDb = tx as unknown as typeof db;

        // 1. Lock — serializes concurrent conversions of THIS request
        const lockedRows = await txDb
          .select()
          .from(requests)
          .where(eq(requests.id, requestId))
          .for("update");

        const req = lockedRows[0] as ServiceRequest | undefined;

        // 2. Validate inside the lock
        validateLocked(req, requestId);

        // 3. Generate job number via sequence — atomic and concurrency-safe.
        //    UNIQUE(jobs_job_number_unique) remains as a last-resort safety net.
        const jobNumber = await numberingService.nextJobNumber();

        // 4. Create job
        const [newJob] = await txDb
          .insert(jobs)
          .values({
            requestId:  req!.id,
            customerId: req!.customerId,
            title:      req!.title,
            jobNumber,
            status:     "pending",
            priority:   req!.priority ?? "normal",
            notes:      req!.clientNotes ?? null,
            updatedAt:  new Date(),
          })
          .returning();
        committedJob = newJob as Job;

        // 5. Mark request converted + record conversion metadata
        const [updated] = await txDb
          .update(requests)
          .set({
            status:            "converted",
            convertedToType:   "job",
            convertedAt:       new Date(),
            convertedByUserId: params.performedBy,
          })
          .where(eq(requests.id, requestId))
          .returning();
        committedRequest = updated as ServiceRequest;
      });
    } catch (err: any) {
      // UNIQUE(jobs_job_number_unique) fired — concurrent numbering collision.
      // This is rare and retryable; expose a clear message rather than a generic 500.
      if (err?.code === PG_UNIQUE_VIOLATION && err?.constraint === "jobs_job_number_unique") {
        throw new ConversionError("Job number conflict — please retry.", 500);
      }
      // ConversionError instances (from validateLocked) and unexpected errors propagate unchanged
      throw err;
    }

    // 6. Post-commit socket event
    if (io) {
      io.to("staff:notifications").emit("request:converted", {
        requestId,
        entityType:  "job",
        entityId:    committedJob.id,
        performedBy,
      });
    }

    return { request: committedRequest, entity: committedJob, entityType: "job" };
  },
};
