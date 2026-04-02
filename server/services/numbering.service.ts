/**
 * NumberingService
 *
 * Provides globally concurrency-safe serial number generation for:
 *   - job numbers    (format: J-XXXX)
 *   - invoice numbers (format: INV-XXXXX)
 *
 * ── Why MAX() was removed ────────────────────────────────────────────────────
 * The previous approach used SELECT MAX(numeric_value) + 1 from the target
 * table. This is not safe under concurrency: two transactions executing
 * simultaneously read the same MAX, both compute the same next number, and
 * one of them fails on the UNIQUE constraint (or silently duplicates if the
 * constraint was absent). Even with the UNIQUE guard in place, this meant
 * one out of every two concurrent creations would hard-fail and require a
 * retry — unacceptable for a production system.
 *
 * ── Why PostgreSQL sequences are the correct solution ───────────────────────
 * PostgreSQL sequences use an internal atomic counter that is NOT subject to
 * transaction isolation. NEXTVAL advances the sequence counter and returns a
 * unique value to the caller, regardless of what any other concurrent
 * session is doing. Two concurrent calls to NEXTVAL always return different
 * values. There is no way to produce a duplicate through normal operation.
 *
 * Sequences are non-transactional: if the calling transaction rolls back,
 * the sequence value is consumed and a gap appears in the number series
 * (e.g., J-0041, J-0043). This is the correct and expected trade-off.
 * Gaps in job or invoice numbers are operationally acceptable and are common
 * in any production system that uses sequences.
 *
 * ── Why UNIQUE constraints are still kept ───────────────────────────────────
 * The UNIQUE constraints on job_number and invoice_number remain in place
 * as a hard safety net for:
 *   - data imported or patched outside the application
 *   - any future code path that bypasses this service
 *   - manual DB operations
 * With sequences as the generator, these constraints will essentially never
 * fire in normal operation. They remain as a last-resort integrity guard.
 *
 * ── Sequence initialization ──────────────────────────────────────────────────
 * Both sequences are created by migration 0003_numbering_sequences.sql,
 * which initializes each sequence's starting value from the current MAX()
 * of the corresponding column in the database. This one-time bootstrap
 * preserves all existing numbers and ensures no conflicts with historical data.
 */

import { pool } from "../db";

// ─── Service ──────────────────────────────────────────────────────────────────

export const numberingService = {

  /**
   * Returns the next globally unique job number in format J-XXXX.
   *
   * Uses PostgreSQL sequence `job_number_seq`. Each call is atomic and
   * independent of any currently open transactions. Safe under any level
   * of concurrency.
   *
   * If called inside a Drizzle transaction, the sequence is still advanced
   * on the pool (not the transaction connection) because sequences are
   * non-transactional. A gap will occur if the calling transaction rolls back.
   */
  async nextJobNumber(): Promise<string> {
    try {
      const { rows } = await pool.query<{ val: string }>(
        "SELECT nextval('job_number_seq')::text AS val",
      );
      return `J-${String(rows[0].val).padStart(4, "0")}`;
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes("job_number_seq")) {
        throw new Error(
          "job_number_seq sequence is missing. Run: npm run db:migrate (migration 0003_numbering_sequences.sql)",
        );
      }
      throw err;
    }
  },

  /**
   * Returns the next globally unique invoice number in format INV-XXXXX.
   *
   * Uses PostgreSQL sequence `invoice_number_seq`. Same concurrency
   * semantics as nextJobNumber().
   */
  async nextInvoiceNumber(): Promise<string> {
    try {
      const { rows } = await pool.query<{ val: string }>(
        "SELECT nextval('invoice_number_seq')::text AS val",
      );
      return `INV-${String(rows[0].val).padStart(5, "0")}`;
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes("invoice_number_seq")) {
        throw new Error(
          "invoice_number_seq sequence is missing. Run: npm run db:migrate (migration 0003_numbering_sequences.sql)",
        );
      }
      throw err;
    }
  },

};
