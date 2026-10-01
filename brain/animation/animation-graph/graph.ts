// Animation graph (§9): causal DAG of the whole animation.
import type { AnimationGraph, TimelineEvent } from "../types";

export function buildGraph(timeline: TimelineEvent[]): AnimationGraph {
  const nodes = timeline.map((t, i) => ({
    id: `n${i}`,
    label: t.label.toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "") || `STEP_${i}`,
    elementIds: t.elementIds,
    at: t.at,
  }));
  const edges = nodes.slice(1).map((n, i) => ({
    from: nodes[i].id,
    to: n.id,
    kind: "causes" as const,
  }));
  return { nodes, edges };
}

/** Render graph as ASCII chain for reports: [A] → [B] → [C]. */
export function graphToChain(g: AnimationGraph): string {
  if (!g.nodes.length) return "[EMPTY]";
  return g.nodes.map((n) => `[${n.label}]`).join("\n      ↓\n");
}
