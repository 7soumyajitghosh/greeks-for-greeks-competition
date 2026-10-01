import type { MemoryManager } from "../memory/MemoryManager";

export interface KnowledgeSource { uri: string; label: string; text: string; metadata?: Record<string, unknown>; }
export interface RetrievalResult { context: string; sources: Array<{ uri: string; label: string }>; }

// Query → understand → vector search (memory) + static sources → metadata filter → rerank → context.
export class RetrievalEngine {
  private sources: KnowledgeSource[] = [];
  constructor(private memory: MemoryManager) {}

  addSource(s: KnowledgeSource): void { this.sources.push(s); }
  addSources(list: KnowledgeSource[]): void { this.sources.push(...list); }

  async retrieve(query: string, topK = 4): Promise<RetrievalResult> {
    const normalized = query.toLowerCase().replace(/\s+/g, " ").trim();
    const mems = await this.memory.search({ text: normalized, scopes: ["semantic", "episodic", "project", "codebase"], topK });
    const qTokens = new Set(normalized.split(/[^a-z0-9]+/).filter((t) => t.length > 2));
    const scoredSources = this.sources
      .map((s) => {
        const sTokens = new Set(s.text.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 2));
        let overlap = 0;
        for (const t of qTokens) if (sTokens.has(t)) overlap++;
        const score = qTokens.size ? overlap / qTokens.size : 0;
        return { s, score };
      })
      .filter((x) => x.score > 0.05)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    const parts: string[] = [];
    for (const m of mems) parts.push(`[memory:${m.scope}] ${m.content.slice(0, 600)}`);
    for (const { s } of scoredSources) parts.push(`[source:${s.label}] ${s.text.slice(0, 800)}`);
    return {
      context: parts.join("\n---\n").slice(0, 6000),
      sources: [
        ...scoredSources.map(({ s }) => ({ uri: s.uri, label: s.label })),
      ],
    };
  }
}
