import { Router } from "express";
import { z } from "zod";
import { insertCustomerAddressSchema } from "@shared/schema";
import { requireRole } from "../../../core/middleware/auth.middleware";
import { parseId } from "../../../core/utils/parse-id";
import { customerAddressService, AddressError } from "../../../services/customer-address.service";

export const addressesRouter = Router();

// ─── Customer Addresses ──────────────────────────────────────────────────────
addressesRouter.get("/api/customers/:id/addresses", requireRole("admin", "dispatcher"), async (req, res) => {
  const customerId = parseId(req.params.id);
  if (!customerId) return res.status(400).json({ message: "Invalid customer ID" });
  try {
    const addresses = await customerAddressService.getByCustomer(customerId);
    res.json(addresses);
  } catch (err) {
    res.status(500).json({ message: "Failed to load addresses" });
  }
});

addressesRouter.post("/api/customers/:id/addresses", requireRole("admin", "dispatcher"), async (req, res) => {
  const customerId = parseId(req.params.id);
  if (!customerId) return res.status(400).json({ message: "Invalid customer ID" });
  try {
    const data = insertCustomerAddressSchema.parse({ ...req.body, customerId });
    const addr = await customerAddressService.create(data);
    res.status(201).json(addr);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors });
    if (err instanceof AddressError) return res.status(err.statusCode).json({ message: err.message });
    res.status(500).json({ message: "Failed to create address" });
  }
});

addressesRouter.put("/api/customers/:customerId/addresses/:id", requireRole("admin", "dispatcher"), async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ message: "Invalid address ID" });
  try {
    // customerId is intentionally NOT passed into the service — it derives it from the existing row
    const payload = insertCustomerAddressSchema.partial().parse(req.body);
    const addr = await customerAddressService.update(id, payload);
    res.json(addr);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors });
    if (err instanceof AddressError) return res.status(err.statusCode).json({ message: err.message });
    res.status(500).json({ message: "Failed to update address" });
  }
});

addressesRouter.delete("/api/customers/:customerId/addresses/:id", requireRole("admin", "dispatcher"), async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ message: "Invalid address ID" });
  try {
    await customerAddressService.delete(id);
    res.json({ message: "Address deleted" });
  } catch (err) {
    if (err instanceof AddressError) return res.status(err.statusCode).json({ message: err.message });
    res.status(500).json({ message: "Failed to delete address" });
  }
});
