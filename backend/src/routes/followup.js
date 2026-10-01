const express = require("express");
const { followupSchema, validate } = require("../lib/validator");

const router = express.Router();

// POST /api/followup — rule-based answer using prior context (AI hook later)
router.post("/", validate(followupSchema), async (req, res) => {
  const { question, context = {} } = req.validated;
  const q = question.toLowerCase();
  let answer = "Based on the analysis context: ";

  if (/why/.test(q)) {
    answer += context.likelyCause
      ? `this happens because: ${context.likelyCause}`
      : "the root cause is described in 'likelyCause' above — typically an un-awaited promise, undefined value, or mis-wired handler.";
  } else if (/fix|correct|solve/.test(q)) {
    answer += context.suggestedFix || "apply the suggested fix, then re-run and confirm the error is gone.";
  } else if (/test/.test(q)) {
    answer += "add a regression test reproducing the error, then verify the fixed code passes and the old code fails.";
  } else {
    answer += `${context.suggestedFix || "Apply the suggested fix."} ${context.improvedCode ? "See improvedCode for the corrected version." : ""} Review and test before production use.`;
  }
  res.json({ answer });
});

module.exports = router;
