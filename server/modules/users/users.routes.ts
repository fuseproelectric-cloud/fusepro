import { Router } from "express";
import bcrypt from "bcryptjs";
import { requireAuth, requireRole } from "../../core/middleware/auth.middleware";
import { parseId } from "../../core/utils/parse-id";
import { usersRepository } from "./users.repository";
import { storage } from "../../storage"; // for createTechnician + ensureTeamMember (not yet extracted)

export const usersRouter = Router();

// ─── Safe user list for chat — only id, name, role ──────────────────────────
usersRouter.get("/api/users/list", requireAuth, async (_req, res) => {
  try {
    const all = await usersRepository.getAll();
    res.json(all.map(u => ({ id: u.id, name: u.name, role: u.role })));
  } catch (err) {
    res.status(500).json({ message: "Failed to load users" });
  }
});

// ─── Users (admin) ───────────────────────────────────────────────────────────
usersRouter.get("/api/users", requireRole("admin"), async (_req, res) => {
  try {
    const data = await usersRepository.getAll();
    res.json(data.map((u) => ({ id: u.id, email: u.email, name: u.name, role: u.role, createdAt: u.createdAt })));
  } catch (err) {
    res.status(500).json({ message: "Failed to load users" });
  }
});

usersRouter.post("/api/users", requireRole("admin"), async (req, res) => {
  try {
    const { email, password, name, role } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ message: "Email, password, and name are required" });
    }
    const existing = await usersRepository.getByEmail(email.toLowerCase().trim());
    if (existing) return res.status(409).json({ message: "Email already in use" });
    const hashed = await bcrypt.hash(password, 12);
    const user = await usersRepository.create({
      email: email.toLowerCase().trim(),
      password: hashed,
      name,
      role: role || "technician",
    });
    // Auto-create technician profile when role is technician
    if ((role || "technician") === "technician") {
      await storage.createTechnician({ userId: user.id, status: "available" }).catch(() => {});
    }
    // Add new user to team conversation
    await storage.ensureTeamMember(user.id).catch(() => {});
    res.status(201).json({ id: user.id, email: user.email, name: user.name, role: user.role });
  } catch (err) {
    res.status(500).json({ message: "Failed to create user" });
  }
});

usersRouter.put("/api/users/:id", requireRole("admin"), async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });
    const { name, email, role, password } = req.body;
    const updateData: any = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email.toLowerCase().trim();
    if (role) updateData.role = role;
    if (password) updateData.password = await bcrypt.hash(password, 12);
    const user = await usersRepository.update(id, updateData);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ id: user.id, email: user.email, name: user.name, role: user.role });
  } catch (err) {
    res.status(500).json({ message: "Failed to update user" });
  }
});

usersRouter.delete("/api/users/:id", requireRole("admin"), async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });
    if (id === req.session.userId) {
      return res.status(400).json({ message: "Cannot delete your own account" });
    }
    await usersRepository.delete(id);
    res.json({ message: "User deleted" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete user" });
  }
});
