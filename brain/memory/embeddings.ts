// Deterministic hash embedding (no external service). Replaceable via EmbeddingProvider.
export type Embedding = number[];
export interface EmbeddingProvider {
  embed(text: string): Promise<Embedding> | Embedding;
  dim: number;
}

export function cosineSimilarity(a: Embedding, b: Embedding): number {
  const n = Math.min(a.length, b.length);
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < n; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export class HashEmbeddingProvider implements EmbeddingProvider {
  readonly dim = 64;
  embed(text: string): Embedding {
    const vec = new Array(this.dim).fill(0);
    const tokens = text.toLowerCase().split(/[^a-z0-9_]+/).filter(Boolean);
    for (const tok of tokens) {
      let h = 2166136261;
      for (let i = 0; i < tok.length; i++) { h ^= tok.charCodeAt(i); h = Math.imul(h, 16777619); }
      const idx = Math.abs(h) % this.dim;
      vec[idx] += 1;
    }
    const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
    return vec.map((v) => v / norm);
  }
}
