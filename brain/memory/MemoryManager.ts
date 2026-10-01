import type { MemoryQuery, MemoryRecord, MemoryScope, RankedMemory } from "../core/types";
import { HashEmbeddingProvider, cosineSimilarity, type EmbeddingProvider } from "./embeddings";

export interface MemoryProvider {
  save(record: MemoryRecord): Promise<void> | void;
  search(queryEmbedding: number[], scopes: MemoryScope[] | undefined, topK: number): Promise<MemoryRecord[]> | MemoryRecord[];
  delete(id: string): Promise<boolean> | boolean;
  clear(scope?: MemoryScope): Promise<void> | void;
  count(): number;
  all(): MemoryRecord[];
}

let seq = 0;
const uid = () => `mem_${Date.now().toString(36)}_${(seq++).toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;

export class InMemoryVectorProvider implements MemoryProvider {
  private store = new Map<string, MemoryRecord>();
  save(record: MemoryRecord): void { this.store.set(record.id, record); }
  search(queryEmbedding: number[], scopes: MemoryScope[] | undefined, topK: number): MemoryRecord[] {
    const all = [...this.store.values()].filter((r) => !scopes?.length || scopes.includes(r.scope));
    return all
      .map((r) => ({ r, sim: cosineSimilarity(queryEmbedding, r.embedding) }))
      .sort((a, b) => b.sim - a.sim)
      .slice(0, topK)
      .map((x) => x.r);
  }
  delete(id: string): boolean { return this.store.delete(id); }
  clear(scope?: MemoryScope): void {
    if (!scope) this.store.clear();
    else for (const [k, v] of this.store) if (v.scope === scope) this.store.delete(k);
  }
  count(): number { return this.store.size; }
  all(): MemoryRecord[] { return [...this.store.values()]; }
}

function matchesFilter(r: MemoryRecord, filter?: Record<string, unknown>): boolean {
  if (!filter) return true;
  return Object.entries(filter).every(([k, v]) => r.metadata[k] === v);
}

// Ranking: relevance (vector sim) + recency + importance + task relationship (metadata overlap)
export class MemoryManager {
  constructor(
    private provider: MemoryProvider = new InMemoryVectorProvider(),
    private embedder: EmbeddingProvider = new HashEmbeddingProvider(),
  ) {}

  async remember(content: string, scope: MemoryScope = "episodic", opts: { importance?: number; metadata?: Record<string, unknown> } = {}): Promise<MemoryRecord> {
    const embedding = await this.embedder.embed(content);
    const record: MemoryRecord = {
      id: uid(),
      scope,
      content: content.slice(0, 4000),
      embedding,
      metadata: opts.metadata ?? {},
      importance: opts.importance ?? 0.5,
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
      accessCount: 0,
    };
    await this.provider.save(record);
    return record;
  }

  async retrieve(query: string, topK = 6): Promise<RankedMemory[]> {
    return this.search({ text: query, topK });
  }

  async search(q: MemoryQuery): Promise<RankedMemory[]> {
    const topK = q.topK ?? 6;
    const qEmb = await this.embedder.embed(q.text);
    const candidates = await this.provider.search(qEmb, q.scopes, Math.max(topK * 3, topK));
    const now = Date.now();
    const qTokens = new Set(q.text.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 2));
    const ranked: RankedMemory[] = candidates
      .filter((r) => matchesFilter(r, q.metadataFilter))
      .map((r) => {
        const relevance = cosineSimilarity(qEmb, r.embedding);
        const ageHrs = (now - r.createdAt) / 3_600_000;
        const recency = Math.exp(-ageHrs / 72); // 3-day decay
        const rTokens = new Set(r.content.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 2));
        let overlap = 0;
        for (const t of qTokens) if (rTokens.has(t)) overlap++;
        const taskRel = qTokens.size ? overlap / qTokens.size : 0;
        const score = 0.55 * relevance + 0.15 * recency + 0.2 * r.importance + 0.1 * taskRel;
        return { ...r, score };
      })
      .filter((r) => r.score >= (q.minScore ?? 0.05))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
    for (const r of ranked) {
      r.lastAccessedAt = now;
      r.accessCount += 1;
      await this.provider.save(r);
    }
    return ranked;
  }

  async forget(id: string): Promise<boolean> { return this.provider.delete(id); }
  async summarize(scope?: MemoryScope): Promise<string> {
    const all = this.provider.all().filter((r) => !scope || r.scope === scope);
    if (!all.length) return "No memories stored.";
    const top = [...all].sort((a, b) => b.importance - a.importance).slice(0, 10);
    return top.map((r, i) => `${i + 1}. [${r.scope}] ${r.content.slice(0, 160)}`).join("\n");
  }

  async update(id: string, patch: Partial<Pick<MemoryRecord, "content" | "importance" | "metadata">>): Promise<MemoryRecord | null> {
    const found = this.provider.all().find((r) => r.id === id);
    if (!found) return null;
    if (patch.content) found.embedding = await this.embedder.embed(patch.content);
    const next = { ...found, ...patch, lastAccessedAt: Date.now() };
    await this.provider.save(next);
    return next;
  }

  count(): number { return this.provider.count(); }
}
