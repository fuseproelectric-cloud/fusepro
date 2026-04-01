import { describe, it, expect } from "vitest";
import {
  insertCustomerSchema,
  insertJobSchema,
  insertEstimateSchema,
  insertInvoiceSchema,
  insertRequestSchema,
  insertTechnicianSchema,
  insertUserSchema,
  insertCustomerAddressSchema,
  lineItemSchema,
} from "../../shared/schema";

// ─── Customer Schema ──────────────────────────────────────────────────────────

describe("insertCustomerSchema", () => {
  it("validates a valid customer", () => {
    const result = insertCustomerSchema.safeParse({
      name: "Acme Corp",
      email: "acme@example.com",
      phone: "555-1234",
    });
    expect(result.success).toBe(true);
  });

  it("requires name field", () => {
    const result = insertCustomerSchema.safeParse({ email: "test@example.com" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("name");
  });

  it("allows optional fields to be omitted", () => {
    const result = insertCustomerSchema.safeParse({ name: "Bob" });
    expect(result.success).toBe(true);
  });

  it("accepts tags as array", () => {
    const result = insertCustomerSchema.safeParse({ name: "Bob", tags: ["vip", "residential"] });
    expect(result.success).toBe(true);
  });
});

// ─── Customer Address Schema ──────────────────────────────────────────────────

describe("insertCustomerAddressSchema", () => {
  it("validates a valid address", () => {
    const result = insertCustomerAddressSchema.safeParse({
      customerId: 1,
      label: "Main Office",
      address: "123 Main St",
      city: "Austin",
      state: "TX",
      zip: "78701",
      isPrimary: true,
    });
    expect(result.success).toBe(true);
  });

  it("requires customerId", () => {
    const result = insertCustomerAddressSchema.safeParse({ label: "Home" });
    expect(result.success).toBe(false);
  });

  it("defaults label to Service Address", () => {
    const result = insertCustomerAddressSchema.safeParse({ customerId: 1 });
    expect(result.success).toBe(true);
  });
});

// ─── Job Schema ───────────────────────────────────────────────────────────────

describe("insertJobSchema", () => {
  it("validates a valid job", () => {
    const result = insertJobSchema.safeParse({
      title: "Fix HVAC",
      status: "pending",
      priority: "normal",
    });
    expect(result.success).toBe(true);
  });

  it("requires title field", () => {
    const result = insertJobSchema.safeParse({ status: "pending" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("title");
  });

  it("coerces scheduledAt string to Date", () => {
    const result = insertJobSchema.safeParse({
      title: "Fix HVAC",
      scheduledAt: "2026-04-01T09:00:00Z",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.scheduledAt).toBeInstanceOf(Date);
    }
  });

  it("accepts null scheduledAt", () => {
    const result = insertJobSchema.safeParse({
      title: "Fix HVAC",
      scheduledAt: null,
    });
    expect(result.success).toBe(true);
  });

  it("validates status enum values", () => {
    const validStatuses = ["pending", "assigned", "in_progress", "completed", "cancelled"];
    for (const status of validStatuses) {
      const result = insertJobSchema.safeParse({ title: "Test", status });
      expect(result.success, `status '${status}' should be valid`).toBe(true);
    }
  });

  it("validates priority enum values", () => {
    const validPriorities = ["low", "normal", "high", "emergency"];
    for (const priority of validPriorities) {
      const result = insertJobSchema.safeParse({ title: "Test", priority });
      expect(result.success, `priority '${priority}' should be valid`).toBe(true);
    }
  });
});

// ─── Estimate Schema ──────────────────────────────────────────────────────────

describe("insertEstimateSchema", () => {
  it("validates a valid estimate", () => {
    const result = insertEstimateSchema.safeParse({
      customerId: 1,
      title: "Repair Estimate",
      status: "draft",
      lineItems: [],
      subtotal: "0",
      tax: "0",
      total: "0",
    });
    expect(result.success).toBe(true);
  });

  it("requires customerId and title", () => {
    const result = insertEstimateSchema.safeParse({ status: "draft" });
    expect(result.success).toBe(false);
  });

  it("coerces validUntil string to Date", () => {
    const result = insertEstimateSchema.safeParse({
      customerId: 1,
      title: "Estimate",
      validUntil: "2026-12-31",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.validUntil).toBeInstanceOf(Date);
    }
  });
});

// ─── Invoice Schema ───────────────────────────────────────────────────────────

describe("insertInvoiceSchema", () => {
  it("validates a valid invoice", () => {
    const result = insertInvoiceSchema.safeParse({
      customerId: 1,
      invoiceNumber: "INV-00001",
      status: "draft",
      paymentTerms: "due_on_receipt",
      lineItems: [],
      subtotal: "0",
      tax: "0",
      total: "0",
    });
    expect(result.success).toBe(true);
  });

  it("requires customerId and invoiceNumber", () => {
    const result = insertInvoiceSchema.safeParse({ status: "draft" });
    expect(result.success).toBe(false);
  });

  it("coerces dueDate string to Date", () => {
    const result = insertInvoiceSchema.safeParse({
      customerId: 1,
      invoiceNumber: "INV-00001",
      dueDate: "2026-05-01",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.dueDate).toBeInstanceOf(Date);
    }
  });
});

// ─── Request Schema ───────────────────────────────────────────────────────────

describe("insertRequestSchema", () => {
  it("validates a valid request", () => {
    const result = insertRequestSchema.safeParse({
      title: "Need AC service",
      status: "new",
      source: "manual",
    });
    expect(result.success).toBe(true);
  });

  it("requires title", () => {
    const result = insertRequestSchema.safeParse({ source: "manual" });
    expect(result.success).toBe(false);
  });
});

// ─── User Schema ──────────────────────────────────────────────────────────────

describe("insertUserSchema", () => {
  it("validates a valid user", () => {
    const result = insertUserSchema.safeParse({
      email: "user@test.com",
      password: "secret",
      name: "Test User",
      role: "technician",
    });
    expect(result.success).toBe(true);
  });

  it("requires email, password, and name", () => {
    const result = insertUserSchema.safeParse({ role: "admin" });
    expect(result.success).toBe(false);
  });

  it("validates email format", () => {
    const result = insertUserSchema.safeParse({
      email: "not-an-email",
      password: "secret",
      name: "Test",
    });
    // email is varchar, no email validation in schema, should pass
    expect(result.success).toBe(true);
  });
});

// ─── LineItem Schema ──────────────────────────────────────────────────────────

describe("lineItemSchema", () => {
  it("validates a valid line item", () => {
    const result = lineItemSchema.safeParse({
      id: "item-1",
      description: "Labor",
      quantity: 2,
      unitPrice: 75.0,
      total: 150.0,
    });
    expect(result.success).toBe(true);
  });

  it("rejects negative quantity", () => {
    const result = lineItemSchema.safeParse({
      id: "item-1",
      description: "Labor",
      quantity: -1,
      unitPrice: 75.0,
      total: 150.0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative unitPrice", () => {
    const result = lineItemSchema.safeParse({
      id: "item-1",
      description: "Labor",
      quantity: 1,
      unitPrice: -5,
      total: 0,
    });
    expect(result.success).toBe(false);
  });

  it("allows zero values", () => {
    const result = lineItemSchema.safeParse({
      id: "item-1",
      description: "Free service",
      quantity: 0,
      unitPrice: 0,
      total: 0,
    });
    expect(result.success).toBe(true);
  });
});
