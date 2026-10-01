// Prompt templates per analysis type. Used when AI_API_KEY is set.
// Keep temperature low for fixes; response must be strict JSON.
const SYSTEM = `You are Fixa AI, a senior full-stack mentor. Always return STRICT JSON matching the requested schema. Never invent file paths. Include a beginner-friendly "why". End with a reminder to review and test before production use.`;

const TEMPLATES = {
  fix_error: (ctx) => `${SYSTEM}\nTask: fix_error. Language=${ctx.language} Framework=${ctx.framework}\nStatic findings: ${JSON.stringify(ctx.findings)}\nCode:\n${ctx.code}\nError:\n${ctx.error}\nReturn JSON: {issueSummary, severity(Low|Medium|High|Critical), category, likelyCause, suggestedFix, improvedCode, explanation, nextActions[]}`,
  review_ui: (ctx) => `${SYSTEM}\nTask: review_ui. Check layout, mobile, contrast, spacing, typography, hierarchy, labels, alt, keyboard.\nCode:\n${ctx.code}\nScreenshot: ${ctx.screenshotUrl || "none"}\nReturn JSON: {issueSummary, severity, category, likelyCause, suggestedFix, improvedCode, explanation, nextActions[], uiScore(0-100), uiProblems[]}`,
  review_api: (ctx) => `${SYSTEM}\nTask: review_api. Check routes, await, validation, auth, status codes, SQL injection, perf.\nCode:\n${ctx.code}\nError:\n${ctx.error}\nReturn JSON: {issueSummary, severity, category, likelyCause, suggestedFix, improvedCode, explanation, nextActions[]}`,
  explain: (ctx) => `${SYSTEM}\nTask: explain code line by line for a beginner. Language=${ctx.language}\nCode:\n${ctx.code}\nReturn JSON: {issueSummary, severity:"Low", category:"Explanation", likelyCause:"", suggestedFix:"", improvedCode, explanation, nextActions[]}`,
  improvement_plan: (ctx) => `${SYSTEM}\nTask: improvement_plan. Give prioritized plan: quick wins, refactors, tests, a11y, security.\nCode:\n${ctx.code}\nReturn JSON: {issueSummary, severity, category, likelyCause, suggestedFix, improvedCode, explanation, nextActions[]}`,
};

async function callAI(type, ctx) {
  const key = process.env.AI_API_KEY;
  const url = process.env.AI_API_URL;
  if (!key || !url) return null; // no AI configured -> rule-based fallback
  const prompt = (TEMPLATES[type] || TEMPLATES.fix_error)(ctx);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ prompt, temperature: type === "explain" ? 0.5 : 0.2 }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`AI API ${res.status}`);
  const data = await res.json();
  // Expect provider to return { result: {...} } or raw JSON string in data.text
  if (data.result && typeof data.result === "object") return data.result;
  if (typeof data.text === "string") return JSON.parse(data.text);
  return data;
}

module.exports = { callAI, TEMPLATES };
