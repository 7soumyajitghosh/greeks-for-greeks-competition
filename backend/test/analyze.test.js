const { test } = require("node:test");
const assert = require("node:assert");
const { runRules } = require("../src/lib/rules");
const { detectSecrets } = require("../src/lib/secrets");
const { analyze } = require("../src/lib/analyzer");

test("detects onClick={fn()} bug", () => {
  const f = runRules({ code: "<button onClick={handleLogin()}>Login</button>", error: "" });
  assert.ok(f.some((x) => x.rule === "react-onclick-invoked"));
});

test("detects null-read error", () => {
  const f = runRules({ code: "const n = user.name", error: "Cannot read properties of undefined (reading 'name')" });
  assert.ok(f.some((x) => x.rule === "null-guard"));
});

test("detects secrets", () => {
  assert.ok(detectSecrets("key = 'sk-abcdefgh1234567890'").length > 0);
});

test("analyze returns structured result", async () => {
  const r = await analyze({
    type: "fix_error", language: "javascript", framework: "react",
    code: "<button onClick={handleLogin()}>Login</button>",
    error: "Too many re-renders", screenshotUrl: null,
  });
  assert.ok(r.issueSummary && r.severity && r.suggestedFix && r.improvedCode !== undefined);
  assert.ok(r.improvedCode.includes("onClick={handleLogin}"));
});

test("analyze validates empty input via schema", async () => {
  const { analyzeSchema } = require("../src/lib/validator");
  const p = analyzeSchema.safeParse({ type: "fix_error", code: "", error: "" });
  assert.equal(p.success, false);
});
