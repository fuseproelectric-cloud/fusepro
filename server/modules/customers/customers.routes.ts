import { Router } from "express";
import { z } from "zod";
import { insertCustomerSchema } from "@shared/schema";
import { requireRole } from "../../core/middleware/auth.middleware";
import { parseId } from "../../core/utils/parse-id";
import { customersRepository } from "./customers.repository";

export const customersRouter = Router();

// ─── Customers ──────────────────────────────────────────────────────────────
customersRouter.get("/api/customers", requireRole("admin", "dispatcher"), async (_req, res) => {
  try {
    const data = await customersRepository.getAll();
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: "Failed to load customers" });
  }
});

customersRouter.get("/api/customers/:id", requireRole("admin", "dispatcher"), async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid customer ID" });
    const customer = await customersRepository.getById(id);
    if (!customer) return res.status(404).json({ message: "Customer not found" });
    const customerJobs = await customersRepository.getJobsByCustomer(customer.id);
    res.json({ ...customer, jobs: customerJobs });
  } catch (err) {
    res.status(500).json({ message: "Failed to load customer" });
  }
});

customersRouter.post("/api/customers", requireRole("admin", "dispatcher"), async (req, res) => {
  try {
    const data = insertCustomerSchema.parse(req.body);
    const customer = await customersRepository.create(data);
    res.status(201).json(customer);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors });
    res.status(500).json({ message: "Failed to create customer" });
  }
});

customersRouter.put("/api/customers/:id", requireRole("admin", "dispatcher"), async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid customer ID" });
    const data = insertCustomerSchema.partial().parse(req.body);
    const customer = await customersRepository.update(id, data);
    if (!customer) return res.status(404).json({ message: "Customer not found" });
    res.json(customer);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors });
    res.status(500).json({ message: "Failed to update customer" });
  }
});

customersRouter.delete("/api/customers/:id", requireRole("admin", "dispatcher"), async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid customer ID" });
    await customersRepository.delete(id);
    res.json({ message: "Customer deleted" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete customer" });
  }
});
