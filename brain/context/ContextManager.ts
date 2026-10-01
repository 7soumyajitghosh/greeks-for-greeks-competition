import type { ContextItem, MemoryScope } from "../core/types";
import { estimateTokens, truncateToTokens } from "./tokenizer";

export interface TokenBudget {
  total: number;
  reservedForOutput: number;
  availableForContext: number;
}

export class ContextManager {
  allocateTokenBudget(total: number, reservedForOutput = 2000): TokenBudget {
    return { total, reservedForOutput, availableForContext: Math.max(1000, total - reservedForOutput) };
  }

  estimateTokens(items: ContextItem[]): number {
    return items.reduce((s, i) => s + (i.tokens || estimateTokens(i.content)), 0);
  }

  prioritizeContext(items: ContextItem[]): ContextItem[] {
    const now = Date.now();
    return [...items]
      .map((item) => {
        const ageHrs = (now - item.timestamp) / 3_600_000;
        const recency = Math.exp(-ageHrs / 24); // 24h half-life-ish
        const score = 0.5 * item.importance + 0.3 * recency + 0.2 * (item.role === "system" ? 1 : item.role === "memory" ? 0.7 : 0.5);
        return { item, score };
      })
      .sort((a, b) => b.score - a.score)
      .map((x) => x.item);
  }

  // Greedy knapsack by priority order; summarizes overflow instead of dropping blindly.
  buildContext(items: ContextItem[], budget: TokenBudget): { selected: ContextItem[]; dropped: number; summarized: boolean } {
    const ranked = this.prioritizeContext(items);
    const selected: ContextItem[] = [];
    const dropped: ContextItem[] = [];
    let used = 0;
    for (const item of ranked) {
      const t = item.tokens || estimateTokens(item.content);
      if (used + t <= budget.availableForContext) {
        selected.push(item);
        used += t;
      } else {
        dropped.push(item);
      }
    }
    let summarized = false;
    if (dropped.length > 0) {
      const summary = this.summarizeHistory(dropped);
      const summaryTokens = estimateTokens(summary);
      // make room for summary by trimming lowest-priority selected items if needed
      while (used + summaryTokens > budget.availableForContext && selected.length > 1) {
        selected.pop();
        used = this.estimateTokens(selected);
      }
      selected.push({
        id: `summary_${Date.now()}`,
        role: "system",
        content: `Earlier context summary: ${summary}`,
        tokens: summaryTokens,
        timestamp: Date.now(),
        importance: 0.6,
        source: "summarizer",
      });
      summarized = true;
    }
    // restore chronological order for the model
    selected.sort((a, b) => a.timestamp - b.timestamp);
    return { selected, dropped: dropped.length, summarized };
  }

  compressContext(items: ContextItem[], targetTokens: number): ContextItem[] {
    let current = this.estimateTokens(items);
    if (current <= targetTokens) return items;
    const ranked = this.prioritizeContext(items);
    // truncate lowest-priority items first
    const result = [...ranked];
    for (let i = result.length - 1; i >= 0 && current > targetTokens; i--) {
      const item = result[i];
      const over = current - targetTokens;
      const cut = Math.min(item.tokens, over + 50);
      const newTokens = Math.max(20, item.tokens - cut);
      result[i] = { ...item, content: truncateToTokens(item.content, newTokens), tokens: newTokens };
      current = this.estimateTokens(result);
    }
    return result.sort((a, b) => a.timestamp - b.timestamp);
  }

  summarizeHistory(items: ContextItem[]): string {
    if (!items.length) return "none";
    const byRole = new Map<string, number>();
    for (const i of items) byRole.set(i.role, (byRole.get(i.role) ?? 0) + 1);
    const topics = items
      .slice(-8)
      .map((i) => i.content.slice(0, 120).replace(/\s+/g, " "))
      .join(" | ");
    return `${items.length} earlier messages (${[...byRole.entries()].map(([r, n]) => `${n}x ${r}`).join(", ")}). Key points: ${topics.slice(0, 800)}`;
  }

  buildPrompt(goal: string, context: ContextItem[], memories: string[], scope: MemoryScope[] = []): string {
    const parts = [
      `Goal: ${goal}`,
      memories.length ? `Relevant memory [${scope.join(",") || "mixed"}]:\n${memories.slice(0, 6).join("\n---\n").slice(0, 4000)}` : "",
      context.length ? `Conversation:\n${context.map((c) => `${c.role}: ${c.content.slice(0, 1500)}`).join("\n").slice(0, 8000)}` : "",
    ];
    return parts.filter(Boolean).join("\n\n");
  }
}
