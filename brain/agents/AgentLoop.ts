import type { Action, CognitiveState, ToolCallResult } from "../core/types";
import { nextActionId, recordAction } from "../core/state/CognitiveState";
import type { ToolRegistry } from "../tools/ToolRegistry";
import type { SecurityManager } from "../security/SecurityManager";
import type { Observability } from "../observability/Observability";

export interface LoopStep {
  action: Action;
  toolResult?: ToolCallResult;
  shouldContinue: boolean;
  reason: string;
}

// OBSERVE → UNDERSTAND → PLAN → ACT → OBSERVE → EVALUATE → REPLAN. Bounded + no repeat-failure loops.
export class AgentLoop {
  private recentFailures = new Map<string, number>();

  constructor(
    private tools: ToolRegistry,
    private security?: SecurityManager,
    private obs?: Observability,
  ) {}

  async runPlannedTool(
    state: CognitiveState,
    toolName: string,
    input: unknown,
    riskLevel: "low" | "medium" | "high" = "low",
  ): Promise<{ state: CognitiveState; step: LoopStep }> {
    const failKey = `${toolName}:${JSON.stringify(input).slice(0, 200)}`;
    if ((this.recentFailures.get(failKey) ?? 0) >= 2) {
      const action: Action = { id: nextActionId(), kind: "tool_call", name: toolName, input, status: "skipped", error: "Skipped: same action failed twice (loop guard)." };
      return { state: recordAction(state, action), step: { action, shouldContinue: true, reason: "loop-guard-skip" } };
    }
    if (this.security) {
      const gate = this.security.canUseTool(toolName, riskLevel);
      if (!gate.allowed) {
        const action: Action = { id: nextActionId(), kind: "tool_call", name: toolName, input, status: "skipped", error: gate.reason };
        return { state: recordAction(state, action), step: { action, shouldContinue: true, reason: "security-gate" } };
      }
    }
    const action: Action = { id: nextActionId(), kind: "tool_call", name: toolName, input, status: "running", startedAt: Date.now() };
    const result = await this.tools.call(toolName, input);
    action.status = result.success ? "succeeded" : "failed";
    action.output = result.success ? result.output : result.error;
    action.error = result.error;
    action.endedAt = Date.now();
    if (!result.success) this.recentFailures.set(failKey, (this.recentFailures.get(failKey) ?? 0) + 1);
    else this.recentFailures.delete(failKey);
    this.obs?.inc(result.success ? "toolCalls" : "toolErrors");
    this.obs?.log(result.success ? "info" : "warn", "toolCall", { tool: toolName, success: result.success, latencyMs: result.latencyMs });
    const nextState = recordAction(state, action);
    return { state: nextState, step: { action, toolResult: result, shouldContinue: true, reason: result.success ? "tool-ok" : "tool-failed-replan" } };
  }

  shouldStop(opts: { steps: number; maxSteps: number; consecutiveFailures: number }): { stop: boolean; reason: string } {
    if (opts.steps >= opts.maxSteps) return { stop: true, reason: "max execution budget reached" };
    if (opts.consecutiveFailures >= 3) return { stop: true, reason: "too many consecutive failures — asking user" };
    return { stop: false, reason: "" };
  }
}
