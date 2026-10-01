// Trigger understanding (§6): map JS findings + timeline into AnimationTriggers.
import type { AnimationTrigger, JsFinding, TimelineEvent, TriggerType } from "../types";

export function detectTriggers(js: JsFinding, timeline: TimelineEvent[]): AnimationTrigger[] {
  const triggers: AnimationTrigger[] = [];
  const allLabels = timeline.map((t) => t.label);

  const add = (type: TriggerType, source: string, fires: string[], extra: Partial<AnimationTrigger> = {}): void => {
    triggers.push({ type, source, fires, ...extra });
  };

  // First event is always time/page-load gated.
  add("PAGE_LOAD", "document", allLabels.slice(0, 1), { condition: "dom-ready" });
  if (timeline.length > 1) add("TIME", "clock", allLabels.slice(1), { condition: "sequence" });

  if (js.usesScrollListener) add("SCROLL", "window:scroll", allLabels.slice(1), { threshold: 0.2 });
  if (js.usesIntersectionObserver) add("INTERSECTION", "IntersectionObserver", allLabels.slice(1), { threshold: 0.15 });
  if (js.usesPointerEvents) add("POINTER_MOVE", "window:pointermove", []);
  if (js.usesMouseEvents) add("MOUSE_MOVE", "window:mousemove", []);
  if (js.usesTouchEvents) add("TOUCH", "touch", []);
  for (const e of js.customEvents.slice(0, 6)) {
    add("CUSTOM_EVENT", e, [], { condition: `event:${e}` });
  }
  // Chain: each animation end can trigger the next.
  if (timeline.length > 2) {
    add("ANIMATION_END", "previous-event", allLabels.slice(1), { condition: "chain" });
  }
  return triggers;
}

/** Causal trigger chain summary, e.g. WATER_CONTACT → SEED_ACTIVATED → … */
export function triggerChainSummary(triggers: AnimationTrigger[]): string {
  return triggers.map((t) => t.type).join(" → ") || "PAGE_LOAD → TIME";
}
