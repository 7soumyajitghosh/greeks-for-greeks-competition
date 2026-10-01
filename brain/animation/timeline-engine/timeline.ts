// Timeline brain (§5): order MotionTracks into causal TimelineEvents.
// Causality heuristic: an event is "caused by" the previous event whose
// element is its spatial parent or whose endTime overlaps its startTime.
import type { MotionTrack, TimelineEvent, VisualElement } from "../types";

const VERBS: Array<[RegExp, string]> = [
  [/seed/i, "enters"],
  [/soil|land/i, "lands"],
  [/water/i, "interaction begins"],
  [/root/i, "grow"],
  [/trunk/i, "grows"],
  [/branch/i, "grow"],
  [/leaf/i, "appear"],
  [/bloom|flower/i, "blooms"],
  [/wind/i, "begins"],
  [/detach/i, "detach"],
  [/heart/i, "fly"],
  [/particle/i, "appear"],
  [/svg|canvas|img|video/i, "animates in"],
];

function verbFor(id: string): string {
  for (const [re, v] of VERBS) if (re.test(id)) return v;
  return "animates";
}

export function buildTimeline(tracks: MotionTrack[], els: VisualElement[]): TimelineEvent[] {
  const byId = new Map(els.map((e) => [e.id, e]));
  const sorted = [...tracks].sort((a, b) => a.startTime - b.startTime);
  const events: TimelineEvent[] = sorted.map((t) => ({
    at: t.startTime,
    label: `${shortId(t.elementId)} ${verbFor(t.elementId)}`,
    elementIds: [t.elementId],
    causedBy: [],
  }));

  // Causal links: an event follows the previous one when their windows
  // overlap, or when it grows out of the previous element (parent link).
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const cur = sorted[i];
    const curEl = byId.get(cur.elementId);
    const overlaps = prev.endTime >= cur.startTime - 1;
    const growsOutOfPrev = curEl?.parent === prev.elementId;
    if (overlaps || growsOutOfPrev) {
      events[i].causedBy.push(events[i - 1].label);
      events[i].cause = `after ${events[i - 1].label}`;
    }
  }

  // Scene-establishing event at t=0
  if (events.length && events[0].at > 0) {
    events.unshift({ at: 0, label: "scene established", elementIds: [], causedBy: [] });
  }
  return events;
}

function shortId(id: string): string {
  const parts = id.split(".");
  return parts[parts.length - 1].replace(/-/g, " ");
}

/** Pretty print: "02.30s Water interaction begins". */
export function formatTimeline(events: TimelineEvent[]): string[] {
  return events.map((e) => `${(e.at / 1000).toFixed(2).padStart(5, "0")}s ${capitalize(e.label)}`);
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
