// §23 Multi-model coding brain — role abstraction + routing.
// The CodingBrain remains the orchestrator; roles specialize.

import type { CodingRole } from "../types";

export interface RoleRoute { role: CodingRole; modelHint: string; reason: string; }

const ROLE_MODEL: Record<CodingRole, string> = {
  architect: "reasoning model (large context, high quality)",
  coder: "coding-specialized model",
  debugger: "reasoning + execution-capable model",
  reviewer: "independent review model (different family from coder when possible)",
  "test-engineer": "fast precise model with test conventions",
  security: "security-focused analysis",
  performance: "analytical model with systems knowledge",
  documenter: "fast model",
};

export class CodingModelRouter {
  route(task: string, complexity: "simple" | "medium" | "complex"): RoleRoute[] {
    const t = task.toLowerCase();
    const plan: RoleRoute[] = [];
    const push = (role: CodingRole, reason: string) =>
      plan.push({ role, modelHint: ROLE_MODEL[role], reason });
    if (/architect|design|refactor|system|migrat/i.test(t) || complexity === "complex") {
      push("architect", "complex architecture → reasoning model");
    }
    if (/secur|auth|xss|inject|secret/i.test(t)) push("security", "auth/security surface → security-focused analysis");
    if (/perf|slow|n\+1|render|bundle|cache/i.test(t)) push("performance", "perf question → systems analysis");
    if (/bug|fail|error|crash|undefined/i.test(t)) push("debugger", "failure → debug specialist");
    push("coder", /simple|typo|rename|comment/i.test(t) && complexity === "simple" ? "simple modification → fast model" : "implementation → coding-specialized model");
    if (complexity !== "simple") {
      push("reviewer", "non-trivial change → independent review model");
      push("test-engineer", "non-trivial change → dedicated test engineer");
    }
    return plan;
  }
}
