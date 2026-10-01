// §16 Self review + §24 Independent review + §20 Security brain + §21 Performance brain
// + §17 Testing brain.

import type {
  ParsedFile, PerfFinding, ReviewFinding, ReviewReport, SecurityFinding, TestPlan,
} from "../types";

// ---- §16 self code review ----
export class SelfReviewer {
  review(files: Array<{ path: string; content: string }>): ReviewReport {
    const findings: ReviewFinding[] = [];
    for (const f of files) {
      const body = f.content;
      const lines = body.split("\n");
      lines.forEach((line, i) => {
        const n = i + 1;
        if (line.length > 140) findings.push({ severity: "minor", category: "readability", message: "line exceeds 140 chars", file: f.path, line: n });
        if (/\bany\b/.test(line)) findings.push({ severity: "minor", category: "correctness", message: "weak type `any`", file: f.path, line: n, suggestion: "narrow the type" });
        if (/console\.log/.test(line)) findings.push({ severity: "info", category: "maintainability", message: "leftover console.log", file: f.path, line: n, suggestion: "remove or gate behind debug flag" });
        if (/TODO|FIXME/.test(line)) findings.push({ severity: "info", category: "maintainability", message: line.trim().slice(0, 100), file: f.path, line: n });
        if (/password|secret|api[_-]?key\s*=\s*["'][^"']+["']/.test(line)) findings.push({ severity: "critical", category: "security", message: "possible hardcoded secret", file: f.path, line: n, suggestion: "move to env/secret store" });
      });
      if (/await/.test(body) && !/try|catch|\.catch/.test(body)) {
        findings.push({ severity: "major", category: "error-handling", message: "async work without visible error handling", file: f.path, suggestion: "add try/catch or documented propagation" });
      }
      if (/\buseEffect\b/.test(body) && !/return\s*\(\s*\)\s*=>|abort|cancel|cleanup/i.test(body)) {
        findings.push({ severity: "minor", category: "concurrency", message: "effect may lack cleanup (stale async update risk)", file: f.path });
      }
      const fnCount = (body.match(/function\s+\w+|=>\s*\{/g) ?? []).length;
      if (fnCount === 0 && body.length > 2000) {
        findings.push({ severity: "minor", category: "architecture", message: "large module with no clear function boundaries", file: f.path });
      }
    }
    const critical = findings.filter((x) => x.severity === "critical").length;
    const major = findings.filter((x) => x.severity === "major").length;
    const score = Math.max(0, 1 - (critical * 0.4 + major * 0.15 + findings.length * 0.01));
    const productionReady = critical === 0 && major === 0;
    return {
      approved: productionReady,
      productionReady,
      trustAnswer: productionReady
        ? "Yes — I would trust this in production (no critical/major findings); ship after tests pass."
        : `No — I would not trust this in production: ${critical} critical, ${major} major finding(s) must be fixed first.`,
      findings: findings.slice(0, 40),
      score: Number(score.toFixed(2)),
    };
  }
}

// ---- §24 independent reviewer: different reasoning path, compares ----
export class IndependentReviewer {
  /** Re-derives verdict from scratch (rules differ from SelfReviewer) then compares. */
  secondOpinion(
    files: Array<{ path: string; content: string }>,
    first: ReviewReport,
  ): { second: ReviewReport; agreement: boolean; escalations: string[] } {
    const second = this.independentPass(files);
    const escalations: string[] = [];
    if (first.approved !== second.approved) {
      escalations.push(`Reviewer disagreement: primary=${first.approved ? "approve" : "block"} vs independent=${second.approved ? "approve" : "block"} — blocking change until resolved.`);
    }
    for (const f of second.findings) {
      if (f.severity === "critical" && !first.findings.some((x) => x.message === f.message)) {
        escalations.push(`Independent reviewer found new critical: ${f.message} (${f.file ?? "?"})`);
      }
    }
    return { second, agreement: escalations.length === 0, escalations };
  }

  private independentPass(files: Array<{ path: string; content: string }>): ReviewReport {
    const findings: ReviewFinding[] = [];
    for (const f of files) {
      if (/eval\(|new\s+Function\(/.test(f.content)) {
        findings.push({ severity: "critical", category: "security", message: "dynamic code execution (eval/new Function)", file: f.path, suggestion: "remove; use allowlisted dispatch" });
      }
      if (/innerHTML|dangerouslySetInnerHTML/.test(f.content) && !/sanitiz|escape|DOMPurify/i.test(f.content)) {
        findings.push({ severity: "critical", category: "security", message: "unsanitized HTML injection sink", file: f.path, suggestion: "sanitize or use text nodes" });
      }
      if (f.content.split("\n").length > 500) {
        findings.push({ severity: "minor", category: "maintainability", message: "file > 500 lines — hard to review safely", file: f.path });
      }
      if (/Promise\.all\(/.test(f.content) && !/allSettled|catch/.test(f.content)) {
        findings.push({ severity: "major", category: "concurrency", message: "Promise.all without failure isolation — one rejection fails all", file: f.path });
      }
    }
    const critical = findings.filter((x) => x.severity === "critical").length;
    return {
      approved: critical === 0,
      productionReady: critical === 0,
      trustAnswer: critical === 0 ? "Independent pass: no blocking issues found." : `Independent pass: BLOCKED by ${critical} critical finding(s).`,
      findings,
      score: critical === 0 ? 0.9 : 0.3,
    };
  }
}

// ---- §20 security brain ----
const SECRET_RE = /(sk-|ghp_|gsk_|xoxb-|AKIA|-----BEGIN [A-Z ]*PRIVATE KEY|api[_-]?key\s*[:=]\s*["'][^"']{8,})/;
const SQL_RE = /(`SELECT.*\$\{|"SELECT.*"\s*\+|'SELECT.*'\s*\+|query\s*\(\s*[`'"]SELECT)/i;
const CMD_RE = /exec\s*\(|spawn\s*\(|execSync|child_process/i;
const PATH_RE = /\.\.\/|path\.join\(.*req\.|readFile.*req\./;

export class SecurityBrain {
  audit(files: ParsedFile[]): SecurityFinding[] {
    const out: SecurityFinding[] = [];
    for (const f of files) {
      const lines = f.content.split("\n");
      lines.forEach((line, i) => {
        const n = i + 1;
        if (SECRET_RE.test(line)) out.push({ severity: "critical", category: "secrets", message: "possible credential/secret in source", file: f.path, line: n });
        if (SQL_RE.test(line)) out.push({ severity: "high", category: "sql-injection", message: "string-interpolated SQL — use parameterized queries", file: f.path, line: n });
        if (/innerHTML|dangerouslySetInnerHTML/.test(line)) out.push({ severity: "high", category: "xss", message: "HTML sink — ensure sanitization", file: f.path, line: n });
        if (CMD_RE.test(line)) out.push({ severity: "high", category: "command-injection", message: "shell execution — validate/allowlist input", file: f.path, line: n });
        if (PATH_RE.test(line)) out.push({ severity: "medium", category: "path-traversal", message: "possible path traversal via request input", file: f.path, line: n });
        if (/password|ssn|credit|token/i.test(line) && /console\.|logger\.|log\(/.test(line)) out.push({ severity: "medium", category: "sensitive-logging", message: "possible sensitive data in logs", file: f.path, line: n });
        if (/Math\.random\(\)/.test(line) && /token|session|password|secret/i.test(f.content.slice(0, 2000))) out.push({ severity: "medium", category: "auth", message: "Math.random used near auth material — use crypto RNG", file: f.path, line: n });
      });
      if (/req\.(body|query|params)/.test(f.content) && !/valid|sanitiz|zod|yup|joi|escape/i.test(f.content)) {
        out.push({ severity: "medium", category: "input-validation", message: "request input used without visible validation", file: f.path });
      }
      if (/auth|login|session/i.test(f.path) && !/401|403|unauthor/i.test(f.content)) {
        out.push({ severity: "low", category: "authorization", message: "auth-adjacent file without explicit 401/403 handling — confirm middleware covers it", file: f.path });
      }
    }
    return out.slice(0, 40);
  }
}

// ---- §21 performance brain ----
export class PerformanceBrain {
  analyze(files: ParsedFile[]): PerfFinding[] {
    const out: PerfFinding[] = [];
    for (const f of files) {
      const body = f.content;
      if (/useEffect.*fetch|fetch.*useEffect|\.map\(.*=>.*fetch\(/s.test(body)) out.push({ category: "api", message: "fetch inside render loop/effect without batching", file: f.path, estimatedImpact: "medium", suggestion: "batch, cache (SWR/React Query), or move out of loop" });
      if (/N\+1|for\s*\(.*await|forEach.*async|\.forEach\(.*await/s.test(body)) out.push({ category: "database", message: "possible N+1 / sequential awaits in loop", file: f.path, estimatedImpact: "high", suggestion: "batch queries (IN clause / DataLoader / Promise.allSettled with limits)" });
      if (/useState.*\[\]|setState.*\[\.\.\./.test(body) && /render|return\s*</.test(body)) out.push({ category: "render", message: "possible unnecessary re-renders (array/object state churn)", file: f.path, estimatedImpact: "medium", suggestion: "memoize (useMemo/useCallback/memo) and measure with profiler" });
      if (/for\s*\([^)]*;[^)]*;[^)]*\)\s*\{[^}]{500,}/s.test(body)) out.push({ category: "cpu", message: "large CPU-heavy loop — measure before optimizing", file: f.path, estimatedImpact: "medium", suggestion: "profile; chunk/offload if hot" });
      if (body.length > 200_000) out.push({ category: "bundle", message: "very large file — bundle impact", file: f.path, estimatedImpact: "medium", suggestion: "code-split / lazy-load" });
      if (/new\s+OpenAI|new\s+Anthropic|fetch.*api\.openai| Bedrock|generateText/i.test(body) && !/cache/i.test(body)) out.push({ category: "model-calls", message: "model call without visible caching", file: f.path, estimatedImpact: "high", suggestion: "cache by prompt hash; dedupe concurrent calls" });
    }
    return out.slice(0, 20);
  }
}

// ---- §17 testing brain ----
export class TestingBrain {
  planForFunction(name: string): TestPlan {
    return {
      target: name,
      unit: ["normal input", "empty input", "invalid input", "boundary input", "large input", "error condition", "concurrent execution"],
      edge: ["null/undefined", "empty collection", "max length", "unicode/special chars"],
    };
  }
  planForApi(route: string): TestPlan {
    return {
      target: route,
      unit: ["happy path 200", "validation 400", "unauthenticated 401", "forbidden 403", "missing 404", "conflict 409", "rate-limit 429", "server error 500", "timeout"],
      api: [
        { case: "happy path", expected: 200 }, { case: "bad body", expected: 400 },
        { case: "no token", expected: 401 }, { case: "wrong owner", expected: 403 },
        { case: "unknown id", expected: 404 }, { case: "duplicate", expected: 409 },
        { case: "flood", expected: 429 }, { case: "downstream down", expected: 500 },
      ],
      edge: ["timeout", "malformed JSON", "oversized payload"],
    };
  }
  planForUi(component: string): TestPlan {
    return { target: component, unit: ["loading", "success", "empty", "error", "mobile", "desktop"], edge: ["slow network", "screen reader", "keyboard-only"] };
  }
}
