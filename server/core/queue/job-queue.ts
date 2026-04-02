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
 * or propagates to the caller. Each log includes the job type for traceability.
 *
 * ── Extension path ────────────────────────────────────────────────────────────
 * To swap in BullMQ or another broker:
 *   1. Implement the same register/enqueue interface
 *   2. Replace the jobQueue singleton export
 *   3. No callers need to change
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JobHandler<T = any> = (payload: T) => Promise<void>;

export class JobQueue {
  private readonly handlers = new Map<string, JobHandler>();

  /** Register a handler for the given job type. */
  register<T>(type: string, handler: (payload: T) => Promise<void>): void {
    this.handlers.set(type, handler as JobHandler);
  }

  /**
   * Schedule a job for async execution.
   * Returns immediately — the handler runs in the next event loop iteration.
   */
  enqueue<T>(type: string, payload: T): void {
    setImmediate(() => void this._dispatch(type, payload));
  }

  /**
   * Dispatch a job directly, awaiting the handler.
   * Used internally by enqueue() and exposed for tests.
   */
  async _dispatch<T>(type: string, payload: T): Promise<void> {
    const handler = this.handlers.get(type);
    if (!handler) {
      console.error(`[job-queue] No handler registered for job type "${type}"`);
      return;
    }
    try {
      await (handler as JobHandler<T>)(payload);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[job-queue] Job "${type}" failed: ${msg}`, err);
    }
  }
}

/** Application-wide singleton. Handlers self-register on import of their module. */
export const jobQueue = new JobQueue();
