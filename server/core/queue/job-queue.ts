/**
 * In-process async job queue.
 *
 * Provides a lightweight background-job mechanism without external
 * infrastructure. Jobs are scheduled via setImmediate so they execute
 * after the current I/O event callback returns — the request handler
 * has already responded before any queued job runs.
 *
 * ── Failure handling ──────────────────────────────────────────────────────────
 * Handler errors are caught and logged. A failing job never crashes the process
 * or propagates to the caller. Each log includes the job type and job ID for
 * traceability.
 *
 * ── BullMQ migration path ─────────────────────────────────────────────────────
 * The IJobQueue interface is the stable contract for callers. To migrate to
 * BullMQ or another broker:
 *   1. Implement IJobQueue against BullMQ's producer API
 *   2. Replace the jobQueue singleton export with the new implementation
 *   3. No callers need to change
 *
 * Known pre-migration blockers (do not merge to BullMQ until resolved):
 *   - NotifyTimesheetActivityPayload.io and NotifyJobActivityPayload.io include
 *     a Socket.IO server reference that is NOT serializable to Redis. Handlers
 *     must be updated to resolve the Socket.IO instance from an app-level
 *     singleton instead of receiving it via payload before migrating.
 */

import { randomUUID } from "crypto";
import { logger } from "../utils/logger";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JobHandler<T = any> = (payload: T) => Promise<void>;

// ─── Public interface ─────────────────────────────────────────────────────────

/**
 * Stable contract for the background job queue.
 * Callers depend on this interface, not on JobQueue directly, so that the
 * underlying implementation can be swapped (e.g. in-process → BullMQ) without
 * touching every enqueue call site.
 */
export interface IJobQueue {
  /** Register a handler for the given job type. */
  register<T>(type: string, handler: (payload: T) => Promise<void>): void;
  /**
   * Schedule a job for async execution.
   * Fire-and-forget: returns immediately. The handler runs in the background.
   */
  enqueue<T>(type: string, payload: T): void;
  /** Number of registered handlers. Exposed for health monitoring. */
  readonly registeredHandlerCount: number;
  /**
   * Dispatch a job directly, awaiting the handler.
   * Exposed for BullMQ worker dispatch and for tests (direct invocation
   * without scheduling overhead).
   * @internal
   */
  _dispatch<T>(type: string, payload: T, jobId?: string): Promise<void>;
}

// ─── Implementation ───────────────────────────────────────────────────────────

export class JobQueue implements IJobQueue {
  private readonly handlers = new Map<string, JobHandler>();

  /**
   * Optional transport override. When set, enqueue() delegates to this function
   * instead of scheduling via setImmediate. Used by the BullMQ backend to route
   * jobs through Redis rather than running them in-process.
   */
  private _enqueueBackend: ((type: string, payload: unknown, jobId: string) => void) | null = null;

  register<T>(type: string, handler: (payload: T) => Promise<void>): void {
    this.handlers.set(type, handler as JobHandler);
  }

  get registeredHandlerCount(): number {
    return this.handlers.size;
  }

  /**
   * Replace the enqueue transport.
   * Called once at server startup when a BullMQ backend is available.
   * Must be called after all handlers are registered (i.e. after registerRoutes()).
   */
  setEnqueueBackend(fn: (type: string, payload: unknown, jobId: string) => void): void {
    this._enqueueBackend = fn;
    logger.info("Job queue transport switched to BullMQ", { source: "job-queue" });
  }

  /**
   * Returns the registered handler for the given type, or undefined.
   * Used by the BullMQ worker to dispatch jobs without going through the
   * error-catching wrapper in _dispatch().
   * @internal
   */
  _getHandler(type: string): JobHandler | undefined {
    return this.handlers.get(type);
  }

  /**
   * Schedule a job for async execution.
   * A unique job_id is generated at enqueue time for log correlation.
   * Returns immediately — the handler runs in the background (either via
   * setImmediate for in-process, or via BullMQ when a backend is set).
   */
  enqueue<T>(type: string, payload: T): void {
    const jobId = randomUUID();
    logger.debug("Job enqueued", { source: "job-queue", job_type: type, job_id: jobId });
    if (this._enqueueBackend) {
      this._enqueueBackend(type, payload, jobId);
    } else {
      setImmediate(() => void this._dispatch(type, payload, jobId));
    }
  }

  /**
   * Dispatch a job directly, awaiting the handler.
   * Catches all errors and logs them — a failed job never propagates to the caller.
   * Used internally by the in-process transport (setImmediate path) and by tests.
   * The BullMQ worker calls _getHandler() directly so that errors propagate to
   * BullMQ for retry handling.
   */
  async _dispatch<T>(type: string, payload: T, jobId?: string): Promise<void> {
    const handler = this.handlers.get(type);
    if (!handler) {
      logger.warn("No handler registered for job type", { source: "job-queue", job_type: type, job_id: jobId });
      return;
    }
    try {
      await (handler as JobHandler<T>)(payload);
      logger.debug("Job completed", { source: "job-queue", job_type: type, job_id: jobId });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error("Job failed", { source: "job-queue", job_type: type, job_id: jobId, message });
    }
  }
}

/** Application-wide singleton. Handlers self-register on import of their module. */
export const jobQueue: IJobQueue = new JobQueue();
