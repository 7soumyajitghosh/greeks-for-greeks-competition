const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const UPLOAD_DIR = process.env.UPLOAD_DIR || "./uploads";
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({
  dest: UPLOAD_DIR,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB per plan.md
  fileFilter: (_req, file, cb) => {
    const ok = ["image/png", "image/jpeg", "image/webp"].includes(file.mimetype);
    cb(ok ? null : new Error("Only png/jpg/webp allowed"), ok);
  },
});

const router = express.Router();

// POST /api/upload (field: screenshot) -> { screenshotUrl }
router.post("/", upload.single("screenshot"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  const ext = { "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp" }[req.file.mimetype];
  const finalPath = path.join(UPLOAD_DIR, req.file.filename + (ext || ""));
  fs.renameSync(req.file.path, finalPath);
  res.status(201).json({ screenshotUrl: `/uploads/${path.basename(finalPath)}` });
});

router.use((err, _req, res, _next) => {
  res.status(400).json({ error: err.message });
});

module.exports = router;
