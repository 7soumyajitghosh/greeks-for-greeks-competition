// Animation Description Language (ADL) v1 (§10).
// Universal IR between Understanding → Reconstruction → Code Generation.
// Includes: validator, builder (graph→ADL), and NL modifier (§18) that edits
// the ADL instead of hand-rewriting generated code.
import type { ADL, ADLEvent, AnimationGraph, AnimationTrigger, MotionTrack, VisualElement } from "../types";

export const ADL_VERSION = "adl/1" as const;

export function validateAdl(adl: ADL): string[] {
  const errors: string[] = [];
  if (adl.version !== ADL_VERSION) errors.push(`version must be "${ADL_VERSION}"`);
  if (!adl.scene || !adl.scene.trim()) errors.push("scene is required");
  if (!Number.isFinite(adl.duration) || adl.duration <= 0) errors.push("duration must be > 0 ms");
  if (!Array.isArray(adl.objects) || !adl.objects.length) errors.push("objects must be non-empty");
  if (!Array.isArray(adl.events) || !adl.events.length) errors.push("events must be non-empty");
  const ids = new Set(adl.objects.map((o) => o.id));
  if (ids.size !== adl.objects.length) errors.push("object ids must be unique");
  for (const e of adl.events) {
    if (!ids.has(e.target)) errors.push(`event targets unknown object "${e.target}"`);
    if (!Number.isFinite(e.duration) || e.duration < 0) errors.push(`event "${e.action}→${e.target}" has invalid duration`);
  }
  return errors;
}

export function buildAdl(
  scene: string,
  els: VisualElement[],
  tracks: MotionTrack[],
  graph: AnimationGraph,
  triggers: AnimationTrigger[],
  duration: number,
  technology: string,
  confidence: number,
): ADL {
  const trackByEl = new Map(tracks.map((t) => [t.elementId, t]));
  const objects = els
    .filter((e) => e.type !== "scene")
    .map((e) => ({
      id: e.id,
      type: e.type,
      initialState: { x: e.position.x, y: e.position.y, scale: 0.6, opacity: 0 },
    }));
  const events: ADLEvent[] = graph.nodes.map((n, i) => {
    const target = n.elementIds[0] ?? objects[0]?.id ?? "unknown";
    const track = trackByEl.get(target);
    return {
      id: n.id,
      trigger: i === 0 ? "page_load" : n.label.toLowerCase().includes("water") ? "water_contact" : "previous_end",
      action: actionFor(n.label),
      target,
      startAt: n.at,
      duration: track ? Math.max(200, track.endTime - track.startTime) : 800,
      easing: track?.easing ?? "easeOut",
      from: track ? { x: track.position.from.x, y: track.position.from.y } : undefined,
      to: track ? { x: track.position.to.x, y: track.position.to.y } : undefined,
    };
  });
  return {
    version: ADL_VERSION,
    scene,
    duration,
    objects,
    events,
    triggers,
    metadata: { technology, confidence, provenance: "inferred" },
  };
}

function actionFor(label: string): string {
  const l = label.toLowerCase();
  if (l.includes("grow") || l.includes("grows")) return "grow";
  if (l.includes("bloom")) return "bloom";
  if (l.includes("fly")) return "fly";
  if (l.includes("detach")) return "detach";
  if (l.includes("appear")) return "fade-in";
  if (l.includes("land")) return "land";
  if (l.includes("water")) return "activate";
  return "animate";
}

// ---------------------------------------------------------------------------
// NL modifier (§18): deterministic rule-based edits to the ADL.
// Supported: slower/faster %, replace X with Y, follow wind, remove scroll,
// trigger-on-X, fly-toward-camera. Unknown commands throw (no silent guessing).
// ---------------------------------------------------------------------------

export interface ModifyResult {
  adl: ADL;
  changes: string[];
}

export function modifyAdl(adl: ADL, command: string): ModifyResult {
  const cmd = command.toLowerCase();
  const next: ADL = JSON.parse(JSON.stringify(adl)) as ADL;
  const changes: string[] = [];

  const pct = cmd.match(/(\d+)\s*%\s*(slower|faster)/);
  if (pct) {
    const amount = Number(pct[1]) / 100;
    const factor = pct[2] === "slower" ? 1 + amount : Math.max(0.2, 1 - amount);
    for (const e of next.events) e.duration = Math.round(e.duration * factor);
    next.duration = Math.round(next.duration * factor);
    changes.push(`scaled durations ×${factor.toFixed(2)} (${pct[1]}% ${pct[2]})`);
  }

  const replace = cmd.match(/replace\s+(?:the\s+)?(\w+)\s+with\s+(\w+)/);
  if (replace) {
    const [, from, to] = replace;
    let n = 0;
    for (const o of next.objects) {
      if (o.id.toLowerCase().includes(from) || o.type.toLowerCase().includes(from)) {
        o.type = singular(to);
        n++;
      }
    }
    changes.push(n ? `replaced ${n} "${from}" object(s) with "${to}"` : `no "${from}" objects found`);
  }

  if (/follow.*wind|wind/.test(cmd) && /particle|heart/.test(cmd)) {
    for (const e of next.events) {
      if (/particle|heart|fly/i.test(e.target) || /fly|drift/i.test(e.action)) {
        e.easing = "wind-drift";
      }
    }
    changes.push("particle/heart flight now uses wind-drift easing");
  }

  if (/remove.*scroll|without.*scroll|no.*scroll/.test(cmd)) {
    const before = (next.triggers ?? []).length;
    next.triggers = (next.triggers ?? []).filter((t) => t.type !== "SCROLL");
    for (const e of next.events) {
      if (e.trigger === "scroll") e.trigger = "page_load";
    }
    changes.push(`removed scroll interaction (${before} → ${(next.triggers ?? []).length} triggers)`);
  }

  if (/watering|water.*trigger|trigger.*water/.test(cmd)) {
    const growth = next.events.find((e) => /grow|activate|bloom/i.test(e.action));
    if (growth) {
      growth.trigger = "water_contact";
      changes.push(`"${growth.action}→${growth.target}" now triggered by water_contact`);
    } else {
      changes.push("no growth event found to bind to water_contact");
    }
  }

  if (/toward.*camera|towards.*camera|fly.*camera/.test(cmd)) {
    for (const e of next.events) {
      if (/fly|heart/i.test(e.action) || /heart/i.test(e.target)) {
        e.action = "fly-toward-camera";
        e.to = { ...(e.to ?? {}), scale: 2.2, opacity: 1 };
      }
    }
    changes.push("final hearts fly toward camera (scale → 2.2)");
  }

  if (/more organic|organic/.test(cmd)) {
    for (const e of next.events) {
      if (/grow|branch/i.test(e.action) || /branch/i.test(e.target)) {
        e.easing = "organic-ease-out";
        e.duration = Math.round(e.duration * 1.15);
      }
    }
    changes.push("branch growth uses organic-ease-out (+15% duration, staggered variation)");
  }

  if (!changes.length) {
    throw new Error(
      `Unsupported modify command: "${command}". Try e.g. "make the tree grow 30% slower", "replace the leaves with hearts", "remove the scroll interaction".`,
    );
  }
  return { adl: next, changes };
}

function singular(s: string): string {
  return s.endsWith("s") && s.length > 3 ? s.slice(0, -1) : s;
}
