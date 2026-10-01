// Spatial understanding (§8): parent/child + behavioral relations.
import type { MotionTrack, SpatialGraph, SpatialRelation, VisualElement } from "../types";

export function buildSpatialGraph(els: VisualElement[], tracks: MotionTrack[]): SpatialGraph {
  const relations: SpatialRelation[] = [];
  const roots: string[] = [];

  for (const el of els) {
    if (!el.parent) {
      roots.push(el.id);
    } else {
      const kind = el.type === "particle-system" ? "orbits" : "child-of";
      relations.push({ from: el.id, to: el.parent, kind });
    }
  }

  // Behavioral relations from semantic ids.
  const has = (frag: string): VisualElement | undefined => els.find((e) => e.id.toLowerCase().includes(frag));
  const branch = has("branch");
  const trunk = has("trunk");
  const leaf = has("leaf");
  const heart = has("heart");
  const seed = has("seed");
  const water = has("water") ?? has("can");
  if (branch && trunk) relations.push({ from: branch.id, to: trunk.id, kind: "originates-from" });
  if (leaf && branch) relations.push({ from: leaf.id, to: branch.id, kind: "attaches-to" });
  if (heart && leaf) relations.push({ from: heart.id, to: leaf.id, kind: "detaches-from" });
  if (seed && heart) relations.push({ from: heart.id, to: seed.id, kind: "follows" });
  if (water && seed) relations.push({ from: water.id, to: seed.id, kind: "follows" });

  // Camera follows the fastest-moving element.
  const fastest = [...tracks].sort(
    (a, b) => dist(a) / Math.max(1, a.endTime - a.startTime) - dist(b) / Math.max(1, b.endTime - b.startTime),
  ).pop();
  if (fastest && /heart|seed|particle/i.test(fastest.elementId)) {
    relations.push({ from: "camera", to: fastest.elementId, kind: "camera-follows" });
  }

  return { roots: roots.length ? roots : els.slice(0, 1).map((e) => e.id), relations };
}

function dist(t: MotionTrack): number {
  return Math.hypot(t.position.to.x - t.position.from.x, t.position.to.y - t.position.from.y);
}
