import type { CognitiveState, ReasoningState } from "../core/types";

// Internal structured reasoning. Never expose chain-of-thought verbatim to users;
// Brain.ts only surfaces concise conclusions/decisions.
export class ReasoningEngine {
  analyze(state: CognitiveState, taskDescription: string): ReasoningState {
    const hypotheses = [
      `Direct solution possible for: ${taskDescription.slice(0, 120)}`,
      `Decomposition required (multi-step)`,
      `Missing information — must ask user or retrieve memory/tools`,
    ];
    const evidence = [...state.knownFacts.slice(-5), ...state.observations.slice(-5)];
    const candidateActions = this.candidateActions(state, taskDescription);
    const selectedAction = candidateActions[0] ?? null;
    const confidence = this.scoreConfidence(state, taskDescription);
    return { hypotheses, evidence, constraints: [...state.constraints], candidateActions, selectedAction, confidence };
  }

  private candidateActions(state: CognitiveState, task: string): string[] {
    const t = task.toLowerCase();
    const actions: string[] = [];
    if (state.uncertainties.length > 2) actions.push("retrieve_memory");
    if (/search|latest|docs|url|http/.test(t)) actions.push("tool:web_search");
    if (/file|code|repo|read|implement|fix/.test(t)) actions.push("tool:filesystem");
    if (/run|test|build|execute|calculate/.test(t)) actions.push("tool:code_execution");
    actions.push("model_call");
    if (state.availableTools.includes("browser") && /http/.test(t)) actions.unshift("tool:browser");
    return [...new Set(actions)];
  }

  private scoreConfidence(state: CognitiveState, task: string): number {
    let c = 0.4;
    c += Math.min(0.3, state.knownFacts.length * 0.05);
    c += Math.min(0.2, state.observations.filter((o) => !/fail|error/i.test(o)).length * 0.04);
    c -= Math.min(0.3, state.uncertainties.length * 0.08);
    if (task.length > 500) c -= 0.1;
    return Math.max(0.05, Math.min(0.95, c));
  }

  // User-facing summary: conclusions + evidence + decision only.
  toPublicSummary(r: ReasoningState): string {
    const lines = [
      `Decision: ${r.selectedAction ?? "model_call"} (confidence ${Math.round(r.confidence * 100)}%)`,
      r.evidence.length ? `Evidence: ${r.evidence.slice(-3).join(" | ").slice(0, 400)}` : "",
      r.constraints.length ? `Constraints respected: ${r.constraints.slice(0, 3).join("; ").slice(0, 300)}` : "",
    ];
    return lines.filter(Boolean).join("\n");
  }
}
