import type { Action, EvaluationResult } from "../core/types";

export class Evaluator {
  evaluate(goal: string, response: string, actions: Action[]): EvaluationResult {
    const issues: string[] = [];
    const failedTools = actions.filter((a) => a.kind === "tool_call" && a.status === "failed");
    if (failedTools.length) issues.push(`${failedTools.length} tool call(s) failed: ${failedTools.map((t) => t.name).join(", ")}`);
    if (!response || response.trim().length < 20) issues.push("Response is empty or too short.");

    const keywords = goal.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3).slice(0, 12);
    const respLower = response.toLowerCase();
    const covered = keywords.filter((k) => respLower.includes(k)).length;
    const requirementCoverage = keywords.length ? covered / keywords.length : 0.7;
    if (requirementCoverage < 0.4) issues.push("Response covers few goal keywords; may be off-topic or incomplete.");

    const contradictions = /never.*always|impossible.*done|error.*success/i.test(response) ? 0.1 : 0;
    const completeness = Math.max(0, Math.min(1, 0.55 + actions.filter((a) => a.status === "succeeded").length * 0.08 + requirementCoverage * 0.3 - failedTools.length * 0.1));
    const correctness = Math.max(0, Math.min(1, 0.75 - failedTools.length * 0.08 - contradictions));
    const needsRevision = completeness < 0.6 || correctness < 0.6 || failedTools.length > 0;

    return {
      completeness: round2(completeness),
      correctness: round2(correctness),
      requirementCoverage: round2(requirementCoverage),
      needsRevision,
      issues,
      suggestedNextAction: needsRevision
        ? failedTools.length ? `retry tool ${failedTools[0].name} with modified input` : "replan with narrower subtask and retry model call"
        : undefined,
    };
  }
}

function round2(n: number): number { return Math.round(n * 100) / 100; }
