// Frame sampler (§4 helper): deterministic synthetic frame model.
// For code inputs we synthesize frames from declared keyframes/motions so the
// comparator and optimizer always have something measurable. For real video
// inputs the caller may inject observed frames via `injectFrames`.
import type { ADLObjectState, FrameSample } from "../types";

export interface MotionSpec {
  elementId: string;
  from: { x: number; y: number; scale?: number; opacity?: number; rotation?: number };
  to: { x: number; y: number; scale?: number; opacity?: number; rotation?: number };
  startAt: number;
  duration: number;
}

export function sampleFrames(specs: MotionSpec[], duration: number, fps = 12): FrameSample[] {
  const frames: FrameSample[] = [];
  const steps = Math.max(2, Math.round((duration / 1000) * fps));
  for (let i = 0; i <= steps; i++) {
    const t = Math.round((i / steps) * duration);
    const states: FrameSample["states"] = {};
    for (const s of specs) {
      const p = progress(t, s.startAt, s.duration);
      const e = easeOutCubic(p);
      states[s.elementId] = {
        x: lerp(s.from.x, s.to.x, e),
        y: lerp(s.from.y, s.to.y, e),
        scale: lerp(s.from.scale ?? 1, s.to.scale ?? 1, e),
        opacity: lerp(s.from.opacity ?? 1, s.to.opacity ?? 1, e),
        rotation: lerp(s.from.rotation ?? 0, s.to.rotation ?? 0, e),
      } satisfies ADLObjectState & { x: number; y: number };
    }
    frames.push({ t, states });
  }
  return frames;
}

function progress(t: number, start: number, dur: number): number {
  if (dur <= 0) return t >= start ? 1 : 0;
  return Math.min(1, Math.max(0, (t - start) / dur));
}

function easeOutCubic(p: number): number {
  return 1 - Math.pow(1 - p, 3);
}

function lerp(a: number, b: number, p: number): number {
  return a + (b - a) * p;
}
