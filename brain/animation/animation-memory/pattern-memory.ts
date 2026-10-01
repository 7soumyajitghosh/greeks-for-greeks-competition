// Animation memory (§11): reusable pattern store with keyword retrieval.
// Deterministic, dependency-free; persists to localStorage when available.
import type { AnimationPattern } from "../types";

const SEED_PATTERNS: AnimationPattern[] = [
  {
    id: "organic-branch-growth",
    name: "organic branch growth",
    characteristics: ["progressive path reveal", "irregular branching", "ease-out", "staggered children", "slight random variation"],
    tags: ["branch", "grow", "tree", "organic", "stagger"],
    adlFragment: { duration: 2500 },
    confidence: 0.85,
    uses: 0,
  },
  {
    id: "particle-drift",
    name: "particle drift",
    characteristics: ["low opacity", "wind advection", "looping", "depth-sorted"],
    tags: ["particle", "wind", "drift", "ambient"],
    adlFragment: { duration: 4000 },
    confidence: 0.8,
    uses: 0,
  },
  {
    id: "scroll-reveal",
    name: "scroll reveal",
    characteristics: ["intersection-gated", "fade+rise", "staggered", "once"],
    tags: ["scroll", "reveal", "intersection"],
    adlFragment: { duration: 900 },
    confidence: 0.82,
    uses: 0,
  },
  {
    id: "heart-bloom",
    name: "heart bloom",
    characteristics: ["scale pop", "spring overshoot", "radial stagger"],
    tags: ["heart", "bloom", "spring", "pop"],
    adlFragment: { duration: 1200 },
    confidence: 0.78,
    uses: 0,
  },
  {
    id: "camera-push-in",
    name: "camera push-in",
    characteristics: ["scale toward viewer", "ease-in-out", "focal object grows"],
    tags: ["camera", "fly", "toward", "zoom"],
    adlFragment: { duration: 2000 },
    confidence: 0.75,
    uses: 0,
  },
];

export class PatternMemory {
  private patterns: AnimationPattern[];

  constructor(seed: AnimationPattern[] = SEED_PATTERNS) {
    this.patterns = seed.map((p) => ({ ...p, characteristics: [...p.characteristics], tags: [...p.tags] }));
    this.load();
  }

  list(): AnimationPattern[] {
    return this.patterns.map((p) => ({ ...p }));
  }

  /** Retrieve patterns ranked by tag/characteristic overlap. */
  retrieve(query: string, topK = 3): Array<AnimationPattern & { score: number }> {
    const tokens = new Set(query.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 2));
    return this.patterns
      .map((p) => {
        const hay = [...p.tags, ...p.characteristics.join(" ").split(/[^a-z0-9]+/), ...p.name.split(/[^a-z0-9]+/)].map((s) =>
          s.toLowerCase(),
        );
        let hit = 0;
        for (const t of tokens) if (hay.includes(t)) hit++;
        const score = tokens.size ? hit / tokens.size : 0;
        return { ...p, score };
      })
      .filter((p) => p.score > 0)
      .sort((a, b) => b.score - a.score || b.confidence - a.confidence)
      .slice(0, topK);
  }

  remember(pattern: AnimationPattern): void {
    const i = this.patterns.findIndex((p) => p.id === pattern.id);
    if (i >= 0) this.patterns[i] = { ...pattern };
    else this.patterns.push({ ...pattern });
    this.save();
  }

  recordUse(id: string): void {
    const p = this.patterns.find((x) => x.id === id);
    if (p) {
      p.uses++;
      this.save();
    }
  }

  private key(): string {
    return "animation-brain:patterns:v1";
  }

  private load(): void {
    try {
      if (typeof localStorage === "undefined") return;
      const raw = localStorage.getItem(this.key());
      if (!raw) return;
      const parsed = JSON.parse(raw) as AnimationPattern[];
      if (Array.isArray(parsed) && parsed.length) {
        const byId = new Map(this.patterns.map((p) => [p.id, p]));
        for (const p of parsed) if (p && p.id) byId.set(p.id, p);
        this.patterns = [...byId.values()];
      }
    } catch {
      // storage unavailable — keep in-memory seeds
    }
  }

  private save(): void {
    try {
      if (typeof localStorage === "undefined") return;
      localStorage.setItem(this.key(), JSON.stringify(this.patterns));
    } catch {
      // ignore quota / privacy-mode failures
    }
  }
}
