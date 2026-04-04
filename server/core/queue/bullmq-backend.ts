/**
 * BullMQ backend for the job queue.
 *
 * Implements durable job execution on top of the existing IJobQueue handler
 * registry. When Redis is available this replaces the in-process setImmediate
 * transport; the API surface for callers (jobQueue.enqueue) does not change.
 *
 * ── Architecture ──────────────────────────────────────────────────────────────
 * Producer: a BullMQ Queue that writes job descriptors to Redis.
 * Consumer: a BullMQ Worker in the same process that reads from Redis and calls
 *   the handler registered on the JobQueue singleton.
 *
 * Running producer and consumer in the same process is correct for a monolith.
 * When the app is horizontally scaled, every instance runs a worker — BullMQ
 * ensures each job is processed by exactly one worker (Redis BRPOPLPUSH semantics).
 *
 * ── Retry / backoff ───────────────────────────────────────────────────────────
 * Default per-job settings: 3 attempts, exponential backoff starting at 2 s.
 * This covers transient failures (DB hiccup, socket not yet established) without
 * endlessly retrying unrecoverable errors.
 *
 * ── Error visibility ──────────────────────────────────────────────────────────
 * Failed jobs (all attempts exhausted) are logged at error level with full context.
 * Completed jobs are retained in Redis for 500 entries (for dashboard / debugging).
 * Failed jobs are retained for 1 000 entries.
 */

import { Queue, Worker } from "bullmq";
import type Redis from "ioredis";
import type { JobQueue } from "./job-queue";
import { logger } from "../utils/logger";

const QUEUE_NAME = "background-jobs";

const DEFAULT_JOB_OPTIONS = {
  attempts:  3,
  backoff:   { type: "exponential" as const, delay: 2_000 },
  removeOnComplete: { count: 500 },
  removeOnFail:     { count: 1_000 },
};

export interface BullMQBackend {
  /** Enqueue a job — delegates from JobQueue.enqueue() when backend is active. */
  enqueue(type: string, payload: unknown, jobId: string): void;
  /** Gracefully close the Worker and Queue connections. */
  close(): Promise<void>;
  /** True while the Worker is processing or waiting for jobs. */
  isRunning(): boolean;
}

/**
 * Creates a BullMQ Queue + Worker backed by the given Redis connection.
 *
 * @param redis  Shared ioredis client (used by the Queue producer).
 * @param queue  The application JobQueue instance whose handler registry is used
 *               by the Worker to dispatch jobs.
 */
export function createBullMQBackend(redis: Redis, queue: JobQueue): BullMQBackend {
  const bullQueue = new Queue(QUEUE_NAME, {
    connection:         redis,
    defaultJobOptions:  DEFAULT_JOB_OPTIONS,
  });

  // Workers require a separate connection — BullMQ blocks on BRPOPLPUSH, so
  // sharing the producer connection would starve other commands.
  const workerConn = redis.duplicate();

  const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      const handler = queue._getHandler(job.name);
      if (!handler) {
        // No handler registered. Logging without throwing to avoid pointless retries —
        // a missing handler is a deploy-time bug, not a transient failure.
        logger.error("BullMQ: no handler for job type", {
          source:   "bullmq",
          job_type: job.name,
          job_id:   job.id,
        });
        return;
      }
      logger.debug("BullMQ job started", {
        source:       "bullmq",
        job_type:     job.name,
        job_id:       job.id,
        attempt:      job.attemptsMade + 1,
      });
      // Throw on error — BullMQ catches this and schedules a retry.
      await handler(job.data);
      logger.debug("BullMQ job completed", {
        source:   "bullmq",
        job_type: job.name,
        job_id:   job.id,
      });
    },
    { connection: workerConn },
  );

  worker.on("failed", (job, err) => {
    logger.error("BullMQ job failed (all attempts exhausted)", {
      source:   "bullmq",
      job_type: job?.name,
      job_id:   job?.id,
      attempts: job?.attemptsMade,
      message:  err.message,
    });
  });

  worker.on("error", (err) => {
    logger.error("BullMQ worker error", { source: "bullmq", message: err.message });
  });

  let _running = true;

  return {
    enqueue(type, payload, jobId) {
      void bullQueue.add(type, payload, { jobId }).catch((err: Error) => {
        logger.error("BullMQ: failed to enqueue job", {
          source:   "bullmq",
          job_type: type,
          job_id:   jobId,
          message:  err.message,
        });
      });
    },

    async close() {
      _running = false;
      await worker.close();
      await bullQueue.close();
    },

    isRunning() {
      return _running;
    },
  };
}
