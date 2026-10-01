const express = require("express");
const { analyzeSchema, validate } = require("../lib/validator");
const { analyze } = require("../lib/analyzer");
const { redactSecrets } = require("../lib/secrets");
const store = require("../lib/store");

const router = express.Router();

// POST /api/analyze -> structured result (unsaved by default)
router.post("/", validate(analyzeSchema), async (req, res) => {
  const { type, language, framework, code, error, screenshotUrl } = req.validated;
  try {
    const result = await analyze({ type, language, framework, code, error, screenshotUrl });
    res.status(201).json({ id: null, result });
  } catch (e) {
    res.status(500).json({ error: "Analysis failed", details: e.message });
  }
});

// POST /api/analyze/save -> analyze + persist (explicit save only)
router.post("/save", validate(analyzeSchema), async (req, res) => {
  const { type, language, framework, code, error, screenshotUrl } = req.validated;
  try {
    const result = await analyze({ type, language, framework, code, error, screenshotUrl });
    const record = store.save({
      type, language, framework,
      codeInput: redactSecrets(code),
      errorMessage: redactSecrets(error),
      screenshotUrl: screenshotUrl || null,
      result, score: result.uiScore ?? null,
    });
    res.status(201).json({ id: record.id, result });
  } catch (e) {
    res.status(500).json({ error: "Analysis failed", details: e.message });
  }
});

module.exports = router;
