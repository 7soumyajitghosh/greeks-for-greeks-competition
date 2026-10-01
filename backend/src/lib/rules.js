// Rule-based static checks. Fast, no AI needed. Returns findings[].
// Each finding: { rule, severity, message, fix, improvedSnippet? }
function runRules({ code = "", error = "", language = "", framework = "" }) {
  const findings = [];
  const has = (re) => re.test(code);
  const errHas = (re) => re.test(error);

  // 1. onClick={fn()} invoked during render
  if (/onClick\s*=\s*\{[^}]*\(\)\s*\}/.test(code)) {
    findings.push({
      rule: "react-onclick-invoked",
      severity: "High",
      message: "onClick handler appears to invoke the function during render (onClick={fn()}), so it runs immediately instead of on click.",
      fix: "Pass the reference: onClick={handleLogin} or onClick={() => handleLogin()}",
    });
  }

  // 2. Cannot read properties of undefined/null -> missing null check
  if (errHas(/cannot read propert/i) || errHas(/undefined is not an object/i)) {
    findings.push({
      rule: "null-guard",
      severity: "High",
      message: "Error indicates reading a property of undefined/null. A value is used before it exists (data not loaded, wrong prop name, missing await).",
      fix: "Add optional chaining / guard: data?.user?.name ?? fallback, and check the variable is defined before access.",
    });
  }

  // 3. Missing await on fetch/db call
  if (has(/\b(fetch|axios\.(get|post)|prisma\.\w+\.(find|create|update))\b/) && !has(/\bawait\b/)) {
    findings.push({
      rule: "missing-await",
      severity: "High",
      message: "Async call (fetch/axios/prisma) found without await. The result is a Promise, not data.",
      fix: "Mark the function async and await the call, with try/catch for errors.",
    });
  }

  // 4. == instead of ===
  if (has(/[^=!]==[^=]/)) {
    findings.push({
      rule: "loose-equality",
      severity: "Medium",
      message: "Loose equality (==) can cause unexpected type coercion.",
      fix: "Prefer === / !== unless coercion is intentional.",
    });
  }

  // 5. React list without key
  if (has(/\.map\s*\(/) && !has(/\bkey\s*=/)) {
    findings.push({
      rule: "react-missing-key",
      severity: "Medium",
      message: ".map() rendering without a key prop can cause incorrect updates and warnings.",
      fix: "Add a stable key: {items.map(item => <li key={item.id}>...)}",
    });
  }

  // 6. Fixed pixel widths that break mobile
  const fixedWidths = [...code.matchAll(/width\s*:\s*(\d{3,})px/g)].map((m) => m[0]);
  if (fixedWidths.length > 0) {
    findings.push({
      rule: "fixed-width",
      severity: "Medium",
      message: `Fixed widths (${fixedWidths.slice(0, 3).join(", ")}) can overflow on phones.`,
      fix: "Use max-width: 100% + responsive layout (flex/grid, media queries, Tailwind md: classes).",
    });
  }

  // 7. Input without label
  if (has(/<input(?![^>]*aria-label)(?![^>]*id=)[^>]*>/i)) {
    findings.push({
      rule: "a11y-input-label",
      severity: "Medium",
      message: "<input> without an associated <label>, id, or aria-label hurts accessibility.",
      fix: "Add <label htmlFor=\"...\"> + matching id, or aria-label.",
    });
  }

  // 8. img without alt
  if (has(/<img(?![^>]*alt=)[^>]*>/i)) {
    findings.push({
      rule: "a11y-img-alt",
      severity: "Low",
      message: "<img> without alt text is inaccessible to screen readers.",
      fix: "Add meaningful alt=\"...\" (or alt=\"\" for decorative images).",
    });
  }

  // 9. Possible SQL string concatenation
  if (/SELECT.*\+|query\s*\(.*\+.*\)/i.test(code)) {
    findings.push({
      rule: "sql-injection-risk",
      severity: "High",
      message: "SQL built with string concatenation risks SQL injection.",
      fix: "Use parameterized queries / ORM bindings (e.g., prisma, $1 placeholders).",
    });
  }

  // 10. Wrong HTTP status / res.send without status on error path
  if (/res\.(send|json)\(.*(error|err)/i.test(code) && !/res\.status\(/.test(code)) {
    findings.push({
      rule: "http-status",
      severity: "Low",
      message: "Error response sent without an explicit HTTP status code.",
      fix: "Use res.status(400|401|404|500).json({ error: ... }).",
    });
  }

  return findings;
}

// Produce a naive "fixed" code example for the most common rule hit.
function applyFirstFix(code, findings) {
  let improved = code;
  const top = findings[0];
  if (!top) return code;
  if (top.rule === "react-onclick-invoked") {
    improved = improved.replace(/onClick\s*=\s*\{(\w+)\(\)\s*\}/, "onClick={$1}");
  } else if (top.rule === "loose-equality") {
    improved = improved.replace(/([^=!])==([^=])/g, "$1=== $2".replace(" ", ""));
    improved = improved.replace(/===  /g, "=== ");
  } else if (top.rule === "a11y-img-alt") {
    improved = improved.replace(/<img(?![^>]*alt=)([^>]*)>/i, '<img alt="Describe the image"$1>');
  }
  return improved;
}

module.exports = { runRules, applyFirstFix };
