// §3 Human-like code reading + §8 Intent engine + §9 Architecture detector.

import type {
  ArchitecturePattern, CodeIntent, CodeUnderstanding, ParsedFile, ParsedSymbol, SymbolNode,
} from "../types";

function sliceOf(f: ParsedFile, line: number, radius = 60): string {
  return f.content.split("\n").slice(Math.max(0, line - 1), line + radius).join("\n");
}

function callersOf(symbols: Map<string, SymbolNode>, id: string): string[] {
  return symbols.get(id)?.calledBy ?? [];
}
function calleesOf(symbols: Map<string, SymbolNode>, id: string): string[] {
  return symbols.get(id)?.calls ?? [];
}

// ---- §3 ----
export class HumanCodeReader {
  read(symbol: ParsedSymbol, file: ParsedFile, symbols: Map<string, SymbolNode>): CodeUnderstanding {
    const id = `${file.path}::${symbol.name}`;
    const node = symbols.get(id);
    const body = sliceOf(file, symbol.line);
    const dependencies = [
      ...file.imports.map((i) => i.to),
      ...(node?.calls.map((c) => c.split("::").pop() ?? c) ?? []),
    ].filter((v, i, a) => v && a.indexOf(v) === i).slice(0, 15);
    const dependents = [...new Set([
      ...callersOf(symbols, id).map((c) => c.split("::").pop() ?? c),
      ...this.fileDependents(file, symbols),
    ])].slice(0, 15);

    const assumptions = this.assumptions(symbol, body);
    const risks = this.risks(symbol, body);
    const sideEffects = [
      ...(node?.writes ?? []),
      ...(node?.emits ?? []),
      ...(/fetch\(|axios|prisma|db\.|localStorage|window\.|document\.|console\.|process\.env/.test(body) ? ["external I/O (heuristic — verify by reading body)"] : []),
    ].filter((v, i, a) => a.indexOf(v) === i);
    const edgeCases = this.edgeCases(body);
    return {
      purpose: this.purpose(symbol, body),
      responsibilities: this.responsibilities(symbol, body),
      dependencies,
      dependents,
      assumptions,
      risks,
      sideEffects,
      invariants: this.invariants(body),
      edgeCases,
    };
  }

  private fileDependents(file: ParsedFile, symbols: Map<string, SymbolNode>): string[] {
    void symbols;
    void file;
    return [];
  }

  private purpose(symbol: ParsedSymbol, body: string): string {
    if (symbol.docComment) return symbol.docComment.slice(0, 240);
    const first = body.split("\n").slice(0, 4).join(" ").slice(0, 200);
    const verb = /fetch|load|save|create|update|delete|render|handle|validate|parse|compute|send|login|auth/i.exec(symbol.name + " " + first)?.[0];
    return `${symbol.kind} '${symbol.name}' — ${verb ? `appears to ${verb.toLowerCase()} (inferred, verify against callers)` : "purpose inferred from name/body — verify against callers"}.`;
  }

  private responsibilities(symbol: ParsedSymbol, body: string): string[] {
    const out: string[] = [];
    if (/valid/i.test(body)) out.push("validates input");
    if (/fetch|axios|await/i.test(body)) out.push("performs async I/O");
    if (/setState|useState|render|return\s*</.test(body)) out.push("drives UI state/render");
    if (/prisma|sql|query|db\./i.test(body)) out.push("touches persistence layer");
    if (/throw|catch|except|Result|Error/i.test(body)) out.push("handles/throws errors");
    if (!out.length) out.push(`encapsulates '${symbol.name}' behavior (single responsibility assumed — confirm)`);
    return out.slice(0, 6);
  }

  private assumptions(symbol: ParsedSymbol, body: string): string[] {
    const out: string[] = [];
    if (symbol.params?.length) out.push(`expects params [${symbol.params.join(", ")}] to be defined and correctly typed`);
    if (/\.\w+\s*\(/.test(body) && !/\?\./.test(body)) out.push("assumes intermediate objects are non-null (no optional chaining seen)");
    if (/process\.env\.\w+/.test(body)) out.push("assumes required env vars are set");
    if (/JSON\.parse/.test(body)) out.push("assumes input is valid JSON");
    if (/await/.test(body) && !/try|catch/.test(body)) out.push("assumes awaited calls succeed (no local try/catch)");
    if (/\[0\]|\.length/.test(body)) out.push("assumes collections are non-empty");
    return out.slice(0, 8);
  }

  private risks(symbol: ParsedSymbol, body: string): string[] {
    void symbol;
    const out: string[] = [];
    if (/await/.test(body) && !/try|catch|\.catch/.test(body)) out.push("unhandled async rejection can propagate");
    if (/\bany\b/.test(body)) out.push("weak typing (`any`) hides contract violations");
    if (/dangerouslySetInnerHTML|innerHTML|eval\(|exec\(/.test(body)) out.push("injection risk (XSS/command) — needs security review");
    if (/password|secret|token|api[_-]?key/i.test(body)) out.push("may handle secrets — check for logging/exposure");
    if (body.split("\n").length > 80) out.push("large body — concurrency + edge-case reasoning is harder");
    if (/TODO|FIXME|HACK|XXX/i.test(body)) out.push("contains TODO/FIXME markers — known incomplete areas");
    return out;
  }

  private invariants(body: string): string[] {
    const out: string[] = [];
    if (/if\s*\(!/.test(body)) out.push("guards invalid input early (inferred)");
    if (/return\s+null|return\s+\[\]|return\s+\{\}/.test(body)) out.push("returns empty value instead of throwing on some paths");
    return out.length ? out : ["no explicit invariants detected — treat behavior as inferred"];
  }

  private edgeCases(body: string): string[] {
    const base = [
      "empty input ('' / [] / {} / null / undefined)",
      "API failure / timeout / non-2xx response",
      "unexpected shape (missing fields, wrong types)",
      "concurrent calls / race between requests",
      "large input (perf + memory)",
    ];
    if (/await/.test(body)) base.push("async state updated after unmount / stale closure");
    if (/loop|for|while|map\(|forEach/.test(body)) base.push("off-by-one / empty-collection iteration");
    return base;
  }
}

// ---- §8 Intent engine: WHAT vs WHY, confidence-tagged ----
export class IntentEngine {
  infer(symbol: ParsedSymbol, file: ParsedFile, understanding: CodeUnderstanding): CodeIntent {
    const body = sliceOf(file, symbol.line, 40);
    const constraints: string[] = [];
    if (file.path.includes("server/") || /express|fastify|hono/i.test(body)) constraints.push("must fit backend request/response lifecycle");
    if (/\.tsx?$/.test(file.path) || symbol.kind === "component") constraints.push("must fit component render lifecycle");
    if (/test|spec/i.test(file.path)) constraints.push("test-only: asserts behavior, not ships behavior");
    if (/async|await|Promise/.test(body)) constraints.push("async: ordering + failure paths matter");
    const expectedBehavior = understanding.responsibilities.map((r) => `should ${r}`);
    let confidence = 0.55;
    if (symbol.docComment) confidence += 0.15;
    if (/test/i.test(file.path)) confidence += 0.1;
    if (understanding.dependents.length > 0) confidence += 0.05;
    confidence = Math.min(0.95, confidence);
    return {
      goal: understanding.purpose,
      constraints,
      expectedBehavior,
      designReasoning: `Inferred (confidence ${confidence.toFixed(2)}): name, surrounding architecture, and call shape suggest this exists to ${understanding.responsibilities[0] ?? "serve its callers"}. Treat as hypothesis, not fact.`,
      confidence: Number(confidence.toFixed(2)),
    };
  }
}

// ---- §9 Architecture detector: detect, don't force ----
const SIGNALS: Array<{ pattern: ArchitecturePattern; test: (files: ParsedFile[]) => number }> = [
  { pattern: "mvc", test: (fs) => score(fs, [/controllers?\//, /models?\//, /views?\//]) },
  { pattern: "mvvm", test: (fs) => score(fs, [/viewmodels?\//, /views?\//, /models?\//]) },
  { pattern: "clean", test: (fs) => score(fs, [/entities\//, /usecases?|use-cases?\//, /adapters?\//, /infrastructure\//]) },
  { pattern: "hexagonal", test: (fs) => score(fs, [/ports\//, /adapters?\//, /domain\//]) },
  { pattern: "microservices", test: (fs) => score(fs, [/services?\//, /Dockerfile/, /k8s|docker-compose/]) },
  { pattern: "event-driven", test: (fs) => score(fs, [/events?\//, /handlers?\//, /emit|subscribe|publish/]) },
  { pattern: "repository", test: (fs) => score(fs, [/repositor/, /prisma|typeorm|drizzle|sequelize/]) },
  { pattern: "component", test: (fs) => score(fs, [/components?\//, /\.tsx$/]) },
  { pattern: "di", test: (fs) => score(fs, [/inject|container|provider/i]) },
  { pattern: "observer", test: (fs) => score(fs, [/observer|subscribe|observable/i]) },
  { pattern: "factory", test: (fs) => score(fs, [/factory|create[A-Z]\w+/]) },
];

function score(files: ParsedFile[], res: RegExp[]): number {
  const hay = files.map((f) => `${f.path}\n${f.content.slice(0, 2000)}`).join("\n");
  return res.reduce((n, re) => n + (re.test(hay) ? 1 : 0), 0);
}

export class ArchitectureDetector {
  detect(files: ParsedFile[]): { primary: ArchitecturePattern; scores: Record<string, number>; evidence: string[] } {
    const scored = SIGNALS.map((s) => ({ pattern: s.pattern, score: s.test(files) })).sort((a, b) => b.score - a.score);
    const top = scored[0];
    const evidence = files.slice(0, 6).map((f) => f.path);
    const scores: Record<string, number> = {};
    for (const s of scored) scores[s.pattern] = s.score;
    if (!top || top.score === 0) return { primary: "unknown", scores, evidence };
    // monolith vs microservices refinement
    if (top.pattern === "microservices" && files.length < 30) return { primary: "monolith", scores, evidence };
    return { primary: top.pattern, scores, evidence };
  }
}

export function formatUncertain(intent: CodeIntent): string {
  return `Hypothesis (confidence ${intent.confidence}): ${intent.goal} — NOT a confirmed fact.`;
}
