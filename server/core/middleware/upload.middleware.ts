import multer from "multer";
import path from "path";
import fs from "fs";
import { randomBytes } from "crypto";

export const UPLOADS_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// Explicit whitelist of accepted image extensions.
// Both conditions must pass — MIME type alone is client-controlled and cannot be trusted.
// Add extensions here only when the rest of the app is confirmed to handle that format.
const ALLOWED_UPLOAD_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

export const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${Date.now()}-${randomBytes(8).toString("hex")}${ext}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const mimeOk = file.mimetype.startsWith("image/");
    const extOk  = ALLOWED_UPLOAD_EXTENSIONS.has(ext);
    // Reject if either check fails — prevents MIME spoofing and non-image extensions.
    cb(null, mimeOk && extOk);
  },
});
