const express = require("express");
const store = require("../lib/store");

const router = express.Router();

// GET /api/history -> saved analyses (newest first)
router.get("/", (_req, res) => {
  res.json({ items: store.list() });
});

// GET /api/history/:id
router.get("/:id", (req, res) => {
  const item = store.get(req.params.id);
  if (!item) return res.status(404).json({ error: "Not found" });
  res.json(item);
});

module.exports = router;
