/**
 * CustomerAddressService
 *
 * Owns all primary-address invariants for the customer_addresses table.
 *
 * ── Invariants ────────────────────────────────────────────────────────────────
 * 1. A customer may have zero addresses overall.
 * 2. If a customer has one or more addresses, exactly one must be primary.
 * 3. The first address created for a customer is always forced to primary.
 * 4. Creating a new address with isPrimary=true demotes the existing primary.
 * 5. Updating to isPrimary=true demotes the existing primary.
 * 6. Demoting the sole primary while other addresses still exist is rejected
 *    with 409 — the caller must promote another address explicitly first.
 * 7. Deleting the primary address auto-promotes the oldest remaining address
 *    (createdAt ASC, id ASC as tiebreaker).
 * 8. Deleting the only address for a customer leaves zero addresses (allowed).
 *
 * ── Transaction safety ────────────────────────────────────────────────────────
 * All multi-step normalization (demote + promote/insert/delete) runs inside a
 * single Drizzle transaction. Intermediate state is never visible to other
 * connections.
 *
 * ── DB safety net ─────────────────────────────────────────────────────────────
 * A partial unique index on (customer_id) WHERE is_primary = true (migration
 * 0004) enforces at most one primary per customer at the database level.
 * This fires only if service logic is bypassed (raw SQL, import scripts, etc.).
 */

import { eq, and, ne, asc } from "drizzle-orm";
import { db } from "../db";
import { customerAddresses } from "@shared/schema";
import type { CustomerAddress, InsertCustomerAddress } from "@shared/schema";

// ─── Typed service error ──────────────────────────────────────────────────────

export class AddressError extends Error {
  constructor(
    message: string,
    public readonly statusCode: 404 | 409 | 422,
  ) {
    super(message);
    this.name = "AddressError";
  }
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const customerAddressService = {

  /**
   * Returns all addresses for a customer, ordered primary-first then by
   * createdAt ascending.
   */
  async getByCustomer(customerId: number): Promise<CustomerAddress[]> {
    return db
      .select()
      .from(customerAddresses)
      .where(eq(customerAddresses.customerId, customerId))
      .orderBy(
        // primary first, then oldest first
        asc(customerAddresses.isPrimary),   // false(0) before true(1) — reversed by DESC below
        asc(customerAddresses.createdAt),
      )
      // Drizzle doesn't support DESC on boolean directly in a cross-DB way,
      // so we order isPrimary DESC manually via sql helper:
      .then(rows =>
        rows.sort((a, b) => {
          if (a.isPrimary === b.isPrimary) {
            return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          }
          return a.isPrimary ? -1 : 1; // primary first
        }),
      );
  },

  /**
   * Creates a new address for a customer with primary invariants enforced.
   *
   * Rules applied:
   *   - If the customer currently has no addresses → force isPrimary = true.
   *   - If isPrimary = true and other addresses exist → demote current primary.
   *   - If isPrimary = false (or omitted) and other addresses exist → leave
   *     existing primary unchanged.
   */
  async create(data: InsertCustomerAddress): Promise<CustomerAddress> {
    const customerId = data.customerId;

    let created!: CustomerAddress;

    await db.transaction(async (tx) => {
      const txDb = tx as unknown as typeof db;

      // Count existing addresses for this customer
      const existing = await txDb
        .select({ id: customerAddresses.id })
        .from(customerAddresses)
        .where(eq(customerAddresses.customerId, customerId));

      let shouldBePrimary: boolean;

      if (existing.length === 0) {
        // First address — must be primary regardless of payload
        shouldBePrimary = true;
      } else if (data.isPrimary === true) {
        // Caller wants this to be primary — demote current primary first
        await txDb
          .update(customerAddresses)
          .set({ isPrimary: false })
          .where(
            and(
              eq(customerAddresses.customerId, customerId),
              eq(customerAddresses.isPrimary, true),
            ),
          );
        shouldBePrimary = true;
      } else {
        // Non-primary — leave existing primary unchanged
        shouldBePrimary = false;
      }

      const [addr] = await txDb
        .insert(customerAddresses)
        .values({ ...data, isPrimary: shouldBePrimary })
        .returning();

      created = addr;
    });

    return created;
  },

  /**
   * Updates an existing address with primary invariants enforced.
   *
   * Rules applied:
   *   - The existing row is always fetched first; customerId is derived from it,
   *     NOT from the payload.
   *   - If isPrimary is not in the payload: update other fields only, no primary change.
   *   - If isPrimary = true:
   *       Demote the current primary for that customer (if different from this row),
   *       then apply the update.
   *   - If isPrimary = false:
   *       If this row is not currently primary → allowed.
   *       If this row is currently primary AND other addresses exist → 409.
   *       If this row is the only address → keep isPrimary = true silently.
   *
   * @throws AddressError 404 if address not found
   * @throws AddressError 409 if trying to demote the sole primary while other addresses exist
   */
  async update(
    id: number,
    payload: Partial<InsertCustomerAddress>,
  ): Promise<CustomerAddress> {
    let updated!: CustomerAddress;

    await db.transaction(async (tx) => {
      const txDb = tx as unknown as typeof db;

      // 1. Fetch existing row — derive customerId from DB, not payload
      const existing = await txDb
        .select()
        .from(customerAddresses)
        .where(eq(customerAddresses.id, id));

      const current = existing[0] as CustomerAddress | undefined;
      if (!current) {
        throw new AddressError("Address not found.", 404);
      }

      const customerId = current.customerId;
      const { isPrimary: payloadPrimary, ...otherFields } = payload;

      // 2. Determine the new isPrimary value and apply normalization
      if (payloadPrimary === undefined) {
        // No primary change requested — update other fields as-is
        const [addr] = await txDb
          .update(customerAddresses)
          .set(otherFields)
          .where(eq(customerAddresses.id, id))
          .returning();
        updated = addr;
        return;
      }

      if (payloadPrimary === true) {
        // Promote this address — demote the current primary if it's a different row
        await txDb
          .update(customerAddresses)
          .set({ isPrimary: false })
          .where(
            and(
              eq(customerAddresses.customerId, customerId),
              eq(customerAddresses.isPrimary, true),
              ne(customerAddresses.id, id),
            ),
          );

        const [addr] = await txDb
          .update(customerAddresses)
          .set({ ...otherFields, isPrimary: true })
          .where(eq(customerAddresses.id, id))
          .returning();
        updated = addr;
        return;
      }

      // payloadPrimary === false
      if (!current.isPrimary) {
        // This address is not primary anyway — allow the update
        const [addr] = await txDb
          .update(customerAddresses)
          .set({ ...otherFields, isPrimary: false })
          .where(eq(customerAddresses.id, id))
          .returning();
        updated = addr;
        return;
      }

      // This address IS currently primary and caller wants to demote it
      const others = await txDb
        .select({ id: customerAddresses.id })
        .from(customerAddresses)
        .where(
          and(
            eq(customerAddresses.customerId, customerId),
            ne(customerAddresses.id, id),
          ),
        );

      if (others.length === 0) {
        // Only address — silently keep it primary; no error
        const [addr] = await txDb
          .update(customerAddresses)
          .set({ ...otherFields, isPrimary: true })
          .where(eq(customerAddresses.id, id))
          .returning();
        updated = addr;
        return;
      }

      // Other addresses exist — reject; caller must promote another explicitly
      throw new AddressError(
        "Cannot remove primary status from the only primary address while other addresses exist. Promote another address first.",
        409,
      );
    });

    return updated;
  },

  /**
   * Deletes an address with primary reassignment if needed.
   *
   * Rules applied:
   *   - If the address is not primary → delete normally.
   *   - If the address is primary:
   *       Find the oldest remaining address (createdAt ASC, id ASC) for the same
   *       customer and promote it to primary in the same transaction.
   *       If no remaining address exists, delete and the customer has zero addresses.
   *
   * @throws AddressError 404 if address not found
   */
  async delete(id: number): Promise<void> {
    await db.transaction(async (tx) => {
      const txDb = tx as unknown as typeof db;

      // 1. Fetch the address to determine if it is primary
      const existing = await txDb
        .select()
        .from(customerAddresses)
        .where(eq(customerAddresses.id, id));

      const current = existing[0] as CustomerAddress | undefined;
      if (!current) {
        throw new AddressError("Address not found.", 404);
      }

      if (current.isPrimary) {
        // Find the oldest remaining address to promote
        const candidates = await txDb
          .select()
          .from(customerAddresses)
          .where(
            and(
              eq(customerAddresses.customerId, current.customerId),
              ne(customerAddresses.id, id),
            ),
          )
          .orderBy(
            asc(customerAddresses.createdAt),
            asc(customerAddresses.id),
          )
          .limit(1);

        if (candidates.length > 0) {
          // Promote the oldest remaining address
          await txDb
            .update(customerAddresses)
            .set({ isPrimary: true })
            .where(eq(customerAddresses.id, candidates[0].id));
        }
        // If no candidates, customer will have zero addresses after delete — allowed
      }

      // Delete the target address
      await txDb
        .delete(customerAddresses)
        .where(eq(customerAddresses.id, id));
    });
  },
};
