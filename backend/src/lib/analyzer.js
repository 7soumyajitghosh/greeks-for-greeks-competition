const { runRules, applyFirstFix } = require("./rules");
const { detectSecrets, redactSecrets } = require("./secrets");
const { callAI } = require("./prompts");

function severityRank(s) {
  return { Low: 1, Medium: 2, High: 3, Critical: 4 }[s] || 0;
}

// Build the structured result per plan.md §4. Tries AI, falls back to rules.
async function analyze({ type, language, framework, code, error, screenshotUrl }) {
  const findings = runRules({ code, error, language, framework });
  const secrets = detectSecrets(code + "\n" + error);

  // 1. Try AI if configured
  try {
    const ai = await callAI(type, { language, framework, code, error, screenshotUrl, findings });
    if (ai && ai.issueSummary) {
      return finalize(ai, { findings, secrets, code });
    }
  } catch (e) {
    // fall through to rule-based
  }

  // 2. Rule-based fallback
  return ruleBasedResult({ type, language, framework, code, error, screenshotUrl, findings, secrets });
}

function finalize(result, { findings, secrets, code }) {
  if (secrets.length > 0) {
    result.nextActions = [
      `WARNING: probable secret detected (${secrets.join(", ")}). Revoke/rotate it and remove from code.`,
      ...(result.nextActions || []),
    ];
  }
  if (!result.nextActions) result.nextActions = [];
  if (!result.nextActions.some((a) => /test/i.test(a))) {
    result.nextActions.push("Review and test the fix before production use.");
  }
  return { ...result, staticFindings: findings.map((f) => f.rule) };
}

function ruleBasedResult({ type, language, framework, code, error, screenshotUrl, findings, secrets }) {
  const top = [...findings].sort((a, b) => severityRank(b.severity) - severityRank(a.severity))[0];
  const improvedCode = findings.length ? applyFirstFix(code, findings) : code;

  if (type === "review_ui") {
    const score = Math.max(40, 100 - findings.length * 8 - (code.includes("px") ? 4 : 0));
    return finalize({
      issueSummary: top ? top.message : "No major UI issues detected by static checks",
      severity: top ? top.severity : "Low",
      category: "Frontend / UI",
      likelyCause: top ? top.message : "No obvious static issue; manual review recommended.",
      suggestedFix: top ? top.fix : "Verify spacing (16-24px gaps), 16px+ body text, contrast ≥ 4.5:1, hamburger nav below 768px.",
      originalCode: code.slice(0, 4000),
      improvedCode: improvedCode.slice(0, 4000),
      explanation: top
        ? `Static check '${top.rule}' fired. ${top.fix}`
        : "Static checks passed. For a full review, upload a screenshot and check contrast, tap targets (≥44px), and mobile overflow.",
      nextActions: ["Test on 360px and 768px viewports", "Run axe/Lighthouse accessibility audit", "Review and test the fix before production use."],
      uiScore: score,
      uiProblems: findings.map((f) => f.message),
    }, { findings, secrets, code });
  }

  if (type === "explain") {
    return finalize({
      issueSummary: "Code explanation",
      severity: "Low",
      category: "Learning",
      likelyCause: "",
      suggestedFix: "",
      originalCode: code.slice(0, 4000),
      improvedCode: improvedCode.slice(0, 4000),
      explanation: code
        ? "Read top-to-bottom: imports → state/props → handlers → render/return. Each handler does one job; follow data flow from input to output."
        : "No code provided to explain.",
      nextActions: ["Ask a follow-up about any line you don't understand."],
    }, { findings, secrets, code });
  }

  // fix_error / review_api / improvement_plan default
  const category = type === "review_api" ? "Backend / API" : `Bug fix / ${language} ${framework}`.trim();
  return finalize({
    issueSummary: top ? top.message : (error ? error.slice(0, 200) : "No specific error identified"),
    severity: top ? top.severity : (error ? "Medium" : "Low"),
    category,
    likelyCause: top ? top.message : "No rule matched. Check async flow, null values, prop/handler wiring, and API status codes.",
    suggestedFix: top ? top.fix : "Add guards, await async calls, verify handler wiring, and validate API inputs.",
    originalCode: code.slice(0, 4000),
    improvedCode: improvedCode.slice(0, 4000),
    explanation: top
      ? `Why: ${top.fix} This addresses the root pattern '${top.rule}' found by static analysis.`
      : "Why: no static pattern matched, so start with the most common causes: un-awaited promises, undefined values, and incorrectly wired event handlers.",
    nextActions: findings.slice(1).map((f) => f.fix).concat(["Add a regression test for this case", "Review and test the fix before production use."]).slice(0, 5),
  }, { findings, secrets, code });
}

module.exports = { analyze };
