// Reconstruction (§12): choose the simplest technology capable of the ADL,
// then expand the ADL into a synthetic frame model for render + comparison.
import type { ADL, FrameSample, ReconstructionTarget } from "../types";

export function selectTechnology(adl: ADL): { target: ReconstructionTarget; reason: string } {
  const actions = adl.events.map((e) => e.action.toLowerCase()).join(" ");
  const types = adl.objects.map((o) => o.type.toLowerCase()).join(" ");
  const triggers = (adl.triggers ?? []).map((t) => t.type).join(",");

  if (/camera|webgl|three|3d/.test(actions + types)) {
    return { target: "three", reason: "3D/camera motion requires WebGL" };
  }
  if (/particle|wind|orbit/i.test(actions + types) || adl.objects.some((o) => o.type === "particle-system")) {
    return { target: "canvas", reason: "particle systems render most simply on Canvas 2D" };
  }
  if (/scroll|drag|spring|stagger/i.test(actions + triggers) || adl.events.length > 6) {
    return { target: "gsap", reason: "sequenced/timeline motion with triggers maps to GSAP" };
  }
  if (/svg|path|draw/i.test(actions + types)) {
    return { target: "svg", reason: "path/shape morphing maps to SVG" };
  }
  if (adl.events.length <= 3 && !/spring|bounce|elastic/i.test(actions)) {
    return { target: "css", reason: "few simple transitions — pure CSS suffices" };
  }
  if (/mount|presence|variant/i.test(actions)) {
    return { target: "framer-motion", reason: "mount/presence semantics map to Framer Motion" };
  }
  return { target: "wapi", reason: "general keyframe motion maps to Web Animations API" };
}

/** Expand ADL events into per-frame element states (linear interp + ease). */
export function renderAdlFrames(adl: ADL, fps = 12): FrameSample[] {
  const steps = Math.max(2, Math.round((adl.duration / 1000) * fps));
  const frames: FrameSample[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = Math.round((i / steps) * adl.duration);
    const states: FrameSample["states"] = {};
    for (const o of adl.objects) {
      states[o.id] = {
        x: num(o.initialState.x, 240),
        y: num(o.initialState.y, 180),
        scale: num(o.initialState.scale, 1),
        opacity: num(o.initialState.opacity, 1),
        rotation: num(o.initialState.rotation, 0),
      };
    }
    for (const e of adl.events) {
      const start = e.startAt ?? 0;
      const p = clamp((t - start) / Math.max(1, e.duration));
      const k = easeFor(e.easing ?? "easeOut", p);
      const st = states[e.target];
      if (!st) continue;
      if (e.from?.x !== undefined && e.to?.x !== undefined) st.x = lerp(num(e.from.x, st.x), num(e.to.x, st.x), k);
      if (e.from?.y !== undefined && e.to?.y !== undefined) st.y = lerp(num(e.from.y, st.y), num(e.to.y, st.y), k);
      const fromS = e.from?.scale !== undefined ? num(e.from.scale, 1) : num(st.scale, 1);
      const toS = e.to?.scale !== undefined ? num(e.to.scale, 1) : 1;
      if (e.from?.scale !== undefined || e.to?.scale !== undefined) st.scale = lerp(fromS, toS, k);
      st.opacity = lerp(e.from?.opacity !== undefined ? num(e.from.opacity, 0) : 0, e.to?.opacity !== undefined ? num(e.to.opacity, 1) : 1, k);
      if (e.action === "fly-toward-camera") st.scale = lerp(num(st.scale, 1), 2.2, k);
    }
    frames.push({ t, states });
  }
  return frames;
}

function clamp(p: number): number {
  return Math.min(1, Math.max(0, p));
}

/** Coerce ADL state fields (string|number|boolean|undefined) to number. */
function num(v: string | number | boolean | undefined, fallback: number): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  if (typeof v === "boolean") return v ? 1 : 0;
  return fallback;
}

function lerp(a: number, b: number, p: number): number {
  return a + (b - a) * p;
}

function easeFor(name: string, p: number): number {
  const n = name.toLowerCase();
  if (n.includes("linear")) return p;
  if (n.includes("easeinout") || n === "ease") return p * p * (3 - 2 * p);
  if (n.includes("easein")) return p * p;
  if (n.includes("spring") || n.includes("elastic") || n.includes("bounce")) {
    return p + Math.sin(p * Math.PI * 2) * 0.08 * (1 - p);
  }
  return 1 - Math.pow(1 - p, 3); // easeOut default
}
