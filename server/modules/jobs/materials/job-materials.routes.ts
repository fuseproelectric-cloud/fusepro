import { Router } from "express";
import { z } from "zod";
import { insertJobMaterialSchema } from "@shared/schema";
import { requireAuth, requireJobAccess } from "../../../core/middleware/auth.middleware";
import { parseId } from "../../../core/utils/parse-id";
import { jobMaterialsRepository } from "./job-materials.repository";

export const jobMaterialsRouter = Router();

// ─── Job Materials ────────────────────────────────────────────────────────────

jobMaterialsRouter.get("/api/jobs/:id/materials", requireAuth, requireJobAccess, async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid job id" });
    const materials = await jobMaterialsRepository.getJobMaterials(id);
    res.json(materials);
  } catch (err) {
    res.status(500).json({ message: "Failed to load materials" });
  }
});

jobMaterialsRouter.post("/api/jobs/:id/materials", requireAuth, requireJobAccess, async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid job id" });
    const data = insertJobMaterialSchema.parse({ ...req.body, jobId: id });
    const mat = await jobMaterialsRepository.createJobMaterial(data);
    res.status(201).json(mat);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors });
    res.status(500).json({ message: "Failed to create material" });
  }
});

jobMaterialsRouter.delete("/api/jobs/:id/materials/:materialId", requireAuth, requireJobAccess, async (req, res) => {
  try {
    const materialId = parseId(req.params.materialId);
    if (!materialId) return res.status(400).json({ message: "Invalid material id" });
    await jobMaterialsRepository.deleteJobMaterial(materialId);
    res.json({ message: "Material deleted" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete material" });
  }
});
