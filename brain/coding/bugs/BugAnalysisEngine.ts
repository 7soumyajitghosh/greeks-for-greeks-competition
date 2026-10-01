// §14 BugAnalysisEngine + §15 Debugging strategy.
// BUG → REPRODUCE → TRACE execution → TRACE data → ROOT CAUSE → FIX → TEST.
// Fixes root cause, not the symptom; refuses the lazy `?.` patch without diagnosis.

import type { BugDiagnosis, DataFlow, ParsedFile, SymbolNode } from "../types";

export interface ReproHint { steps: string[]; suspectedFiles: string[]; }

export class BugAnalysisEngine {
  diagnose(
    bugReport: string,
    files: ParsedFile[],
    symbols: Map<string, SymbolNode>,
    flows: DataFlow[] = [],
  ): BugDiagnosis {
    const hay = bugReport.toLowerCase();
    const suspected = files
      .filter((f) => {
        const tokens = hay.split(/[^a-z0-9]+/).filter((t) => t.length > 3);
        const hayF = `${f.path} ${f.content.slice(0, 4000)}`.toLowerCase();
        return tokens.some((t) => hayF.includes(t));
      })
      .slice(0, 5);

    const reproduction = this.reproductionSteps(bugReport, suspected);
    const executionTrace = this.executionTrace(bugReport, suspected, symbols);
    const dataTrace = this.dataTrace(bugReport, flows, suspected);
    const { rootCause, confidence, rejected } = this.rootCause(bugReport, suspected);

    return {
      bugReport,
      reproduction,
      executionTrace,
      dataTrace,
      rootCause,
      rootCauseConfidence: confidence,
      symptomFixRejected: rejected,
      proposedFix: this.proposedFix(rootCause, suspected),
      testsToAdd: this.testsToAdd(bugReport),
    };
  }

  /** §15: the "Cannot read properties of undefined" decision tree. */
  undefinedPropertyDiagnosis(valueName: string, context: { files: ParsedFile[] }): string[] {
    void context;
    return [
      `Why is '${valueName}' undefined? Do NOT just add '?.' — answer first:`,
      "1. Where was it created? (trace definition + assignments)",
      "2. Was validation missing at the boundary (API response / props / store)?",
      "3. Was the API response shape different (null item, renamed field, 204/empty)?",
      "4. Was state updated asynchronously (stale closure, unmounted, race)?",
      "5. Was the wrong object passed by a caller (check all callers)?",
      "Only after answering: fix at the source (validate/default/narrow type), then add a regression test.",
    ];
  }

  private reproductionSteps(bug: string, suspected: ParsedFile[]): string[] {
    void bug;
    return [
      "Restate expected vs actual behavior in one sentence each.",
      ...suspected.slice(0, 3).map((f) => `Exercise code path through ${f.path} with minimal input.`),
      "Capture failing input, stack trace, and environment (route/state/API payload).",
      "Confirm the failure is deterministic; note flakiness (concurrency/timing) if not.",
    ];
  }

  private executionTrace(_bug: string, suspected: ParsedFile[], symbols: Map<string, SymbolNode>): string[] {
    const out: string[] = [];
    for (const f of suspected.slice(0, 3)) {
      for (const s of f.symbols.slice(0, 3)) {
        const id = `${f.path}::${s.name}`;
        const n = symbols.get(id);
        out.push(`${id} — callers: [${(n?.calledBy ?? []).slice(0, 3).join(", ") || "none found"}] → callees: [${(n?.calls ?? []).slice(0, 3).map((c) => c.split("::").pop()).join(", ") || "none"}]`);
      }
    }
    return out.length ? out : ["No execution trace resolved — broaden file search from the stack trace."];
  }

  private dataTrace(_bug: string, flows: DataFlow[], suspected: ParsedFile[]): string[] {
    const related = flows.filter((fl) => suspected.some((s) => fl.steps.some((st) => st.file === s.path))).slice(0, 2);
    if (!related.length) {
      return ["Origin → Validation → Controller → Service → Database → Response → UI: map the failing value through each stage manually (no cached flow matched)."];
    }
    return related.map((fl) => fl.steps.map((s) => `${s.stage}${s.symbol ? `(${s.symbol})` : ""}`).join(" → "));
  }

  private rootCause(bug: string, suspected: ParsedFile[]): { rootCause: string; confidence: number; rejected: string[] } {
    const b = bug.toLowerCase();
    const where = suspected[0]?.path ?? "unknown location";
    const rejected = ["patching only the visible symptom", "adding `?.` / try/catch without understanding the source", "editing tests to make red code green"];
    if (/cannot read propert|undefined|is not a function/.test(b)) {
      return {
        rootCause: `Probable null/undefined source value flowing into ${where} (missing validation or async race). Confidence is heuristic — confirm by tracing definition + API payload before fixing.`,
        confidence: 0.55, rejected,
      };
    }
    if (/500|crash|exception|error:/.test(b)) {
      return { rootCause: `Unhandled failure path near ${where} (missing guard/retry/fallback). Confirm with repro + logs.`, confidence: 0.5, rejected };
    }
    if (/slow|lag|freeze|memory/.test(b)) {
      return { rootCause: `Likely hot path / redundant work near ${where} (unmemoized render, N+1 query, large loop). Measure before optimizing.`, confidence: 0.45, rejected };
    }
    return { rootCause: `Root cause not yet isolated — prime suspect area is ${where}. Reproduce, then trace execution + data before proposing a fix.`, confidence: 0.35, rejected };
  }

  private proposedFix(rootCause: string, suspected: ParsedFile[]): string {
    return `Fix the source identified in root cause (${rootCause.slice(0, 160)}...). Smallest safe change in ${suspected[0]?.path ?? "the suspect file"}: validate/normalize at the boundary, handle the failure path explicitly, keep the diff narrow.`;
  }

  private testsToAdd(bug: string): string[] {
    void bug;
    return ["regression test reproducing the reported failure", "empty/invalid-input cases at the boundary", "failure-path test (API error / timeout)"];
  }
}
