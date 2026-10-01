// §13 Code generation brain (small safe increments) + §18 test→fix→test loop
// + §19 refactoring brain + §22 git/history brain.

import type { ParsedFile } from "../types";

// ---- §13 ----
export interface GenerationStep { title: string; code: string; checks: string[]; }

export class CodeGenerationBrain {
  /** PLAN → SMALL PIECE → TYPECHECK → TEST → CONTINUE. Generates a staged plan,
   *  never one giant blob. Actual code emission is host-assisted; this produces
   *  reviewable increments with checks attached. */
  stage(request: string, files: string[], styleGuidance: string): GenerationStep[] {
    const target = files[0] ?? "src/";
    return [
      {
        title: "Types + interfaces first",
        code: `// Step 1 — contracts for: ${request.slice(0, 80)}\n// Style: ${styleGuidance.split("\n")[0]?.slice(0, 100) ?? "match repo"}\n// TODO(host): emit minimal exported types in ${target}`,
        checks: ["typecheck passes", "no new `any`", "names match repo conventions"],
      },
      {
        title: "Smallest working implementation",
        code: `// Step 2 — narrowest implementation in ${target}\n// - small functions, strong types, predictable errors\n// - no unnecessary abstraction`,
        checks: ["typecheck passes", "targeted test passes"],
      },
      {
        title: "Error handling + edge cases",
        code: `// Step 3 — empty/invalid/boundary inputs + failure paths for ${target}`,
        checks: ["edge-case tests pass", "no swallowed errors"],
      },
    ];
  }

  principles(): string[] {
    return [
      "readable code, meaningful names, strong types",
      "small functions, clear interfaces, predictable error handling",
      "minimal unnecessary abstraction — do not over-engineer",
      "follow existing project conventions",
    ];
  }
}

// ---- §18 test → fix → test loop ----
export interface TestLoopState { iterations: number; failures: string[]; passed: boolean; }

export class TestFixLoop {
  /** Pure policy helper: never hide failures, never rewrite tests to make
   *  incorrect code pass. Only change tests when intended behavior genuinely changed. */
  nextAction(args: { testPassed: boolean; behaviorChanged: boolean; iterations: number; maxIterations?: number }): string {
    const max = args.maxIterations ?? 5;
    if (args.testPassed) return "PASS → record result, move to next test.";
    if (args.iterations >= max) return "STOP → escalate to human with failing output + attempted fixes. Do not loop forever.";
    if (args.behaviorChanged) return "Behavior intentionally changed → update the test to the new contract AND note the change in review.";
    return "FAIL → ANALYZE failure output → FIX source code (not the test) → TEST AGAIN.";
  }

  validateTestEdit(codeChanged: boolean, intendedBehaviorChanged: boolean, testEdited: boolean): string | null {
    if (testEdited && !intendedBehaviorChanged && !codeChanged) {
      return "BLOCKED: editing tests to make incorrect code pass is forbidden.";
    }
    return null;
  }
}

// ---- §19 refactoring brain ----
export interface RefactorSignal { kind: string; location: string; detail: string; }

export class RefactoringBrain {
  inspect(files: ParsedFile[]): RefactorSignal[] {
    const signals: RefactorSignal[] = [];
    for (const f of files) {
      const lines = f.content.split("\n");
      if (lines.length > 400) signals.push({ kind: "huge-file", location: f.path, detail: `${lines.length} LOC — consider splitting` });
      const seen = new Map<string, number>();
      for (const line of lines) {
        const t = line.trim();
        if (t.length < 20) continue;
        seen.set(t, (seen.get(t) ?? 0) + 1);
      }
      for (const [line, n] of seen) {
        if (n >= 4) { signals.push({ kind: "duplication", location: f.path, detail: `repeated line ×${n}: ${line.slice(0, 80)}` }); break; }
      }
      for (const s of f.symbols) {
        const body = lines.slice(s.line - 1, s.line + 80).join("\n");
        if (body.split("\n").length > 70) signals.push({ kind: "huge-function", location: `${f.path}::${s.name}`, detail: "function body > 70 lines" });
        if (/TODO|FIXME/.test(body)) signals.push({ kind: "dead-or-todo", location: `${f.path}::${s.name}`, detail: "contains TODO/FIXME" });
      }
      if (/import.*from.*\.\.\/\.\./.test(f.content) && f.imports.length > 8) {
        signals.push({ kind: "tight-coupling", location: f.path, detail: "many deep relative imports — check boundaries" });
      }
    }
    return signals.slice(0, 20);
  }

  shouldRefactor(signal: RefactorSignal, unrelatedWork: boolean): boolean {
    if (unrelatedWork && (signal.kind === "duplication" || signal.kind === "huge-file")) return false; // avoid cosmetic churn
    return ["duplication", "huge-function", "tight-coupling", "dead-or-todo"].includes(signal.kind);
  }
}

// ---- §22 git / change-history brain ----
export interface HistoryHint { commit?: string; reason: string; safeToChange: boolean; }

export class GitHistoryBrain {
  /** Works with injected history (host runs git); pure reasoning over it. */
  interpret(args: {
    file: string; currentCode: string;
    log?: Array<{ hash: string; message: string; date: string }>;
    blame?: Array<{ line: number; author: string; message: string }>;
  }): HistoryHint {
    const { log = [], blame = [] } = args;
    if (!log.length && !blame.length) {
      return { reason: "No history available — treat strange-looking code as potentially load-bearing. Do not delete without a test proving it is dead.", safeToChange: false };
    }
    const fixy = log.filter((c) => /fix|hotfix|revert|workaround|edge|race|prod/i.test(c.message));
    if (fixy.length) {
      return { commit: fixy[0].hash, reason: `Prior fix '${fixy[0].message}' touched this area — the odd code likely guards a real constraint. Change only with a regression test.`, safeToChange: false };
    }
    return { commit: log[0]?.hash, reason: `Last change: '${log[0]?.message ?? "unknown"}'. No obvious guard signal, but verify callers before changing.`, safeToChange: true };
  }

  strangeCodeChecklist(): string[] {
    return [
      "Current implementation → git log/blame → original reason → constraint understood → then decide",
      "Never assume old code is useless because it looks unusual",
    ];
  }
}
