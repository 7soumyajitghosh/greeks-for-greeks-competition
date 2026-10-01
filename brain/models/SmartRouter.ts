import type { ModelSpec, TaskContext } from "../core/types";

export interface RoutingDecision {
  model: ModelSpec;
  reason: string;
  alternatives: string[];
}

export class SmartRouter {
  constructor(private models: ModelSpec[], private isHealthy: (id: string) => boolean = () => true) {}

  setModels(models: ModelSpec[]): void { this.models = models; }

  route(task: TaskContext, estimatedInputTokens: number): RoutingDecision {
    const candidates = this.models.filter((m) => m.enabled && this.isHealthy(m.id));
    const pool = candidates.length ? candidates : this.models.filter((m) => m.enabled);
    if (!pool.length) throw new Error("No enabled models configured.");

    const needsVision = task.requiredCapabilities.includes("vision") || task.inputType === "image";
    const needsCode = task.requiredCapabilities.includes("coding");
    const needsLong = task.requiredCapabilities.includes("longContext") || estimatedInputTokens > 12000;
    const needsReasoning = task.complexity === "complex" || task.requiredCapabilities.includes("reasoning");

    const scored = pool.map((m) => {
      let score = m.quality * 10;
      let reasons: string[] = [];
      if (needsVision) { score += m.capabilities.vision ? 6 : -10; if (m.capabilities.vision) reasons.push("vision"); }
      if (needsCode) { score += m.capabilities.coding ? 4 : -2; if (m.capabilities.coding) reasons.push("coding"); }
      if (needsLong) {
        if (m.contextWindow >= estimatedInputTokens + 2000) { score += 5; reasons.push("fits-context"); }
        else score -= 10;
        if (m.capabilities.longContext) { score += 2; reasons.push("long-context"); }
      }
      if (needsReasoning) { score += m.capabilities.reasoning ? 5 : -1; if (m.capabilities.reasoning) reasons.push("reasoning"); }
      if (task.complexity === "simple") { score += m.capabilities.lowCost ? 4 : -2; score += m.capabilities.lowLatency ? 3 : 0; if (m.capabilities.lowCost) reasons.push("cheap+fast"); }
      if (m.provider === "mock" && pool.some((x) => x.provider !== "mock" && x.enabled)) {
        // Prefer real providers when configured, but only if they passed health/config checks elsewhere.
        score -= 1;
      }
      // cost/latency penalty for complex tasks is smaller
      score -= (m.costPer1kInput * 100 + m.avgLatencyMs / 2000) * (task.complexity === "simple" ? 1 : 0.3);
      return { m, score, reasons };
    }).sort((a, b) => b.score - a.score);

    const best = scored[0];
    return {
      model: best.m,
      reason: `Selected ${best.m.id} for ${task.complexity}/${task.intent} [${best.reasons.join(",") || "balanced"}] (score ${best.score.toFixed(1)})`,
      alternatives: scored.slice(1, 4).map((s) => s.m.id),
    };
  }

  // Ordered fallback chain: routed model → alternatives → any healthy mock
  fallbackChain(primary: ModelSpec, alternatives: string[]): ModelSpec[] {
    const byId = new Map(this.models.map((m) => [m.id, m]));
    const chain: ModelSpec[] = [primary];
    for (const id of alternatives) {
      const m = byId.get(id);
      if (m && m.enabled && !chain.includes(m)) chain.push(m);
    }
    for (const m of this.models) {
      if (m.enabled && !chain.includes(m)) chain.push(m);
    }
    return chain;
  }
}
