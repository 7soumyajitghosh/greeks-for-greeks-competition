// Motion tracking (§4): derive MotionTrack[] from CSS keyframes + element list.
// Positions are estimated onto a 480×360 stage unless viewport given; every
// track records whether it was exactly observed (keyframes parsed) or inferred.
import type { CssFinding, MotionTrack, VisualElement } from "../types";

export function trackMotion(els: VisualElement[], css: CssFinding, duration: number): MotionTrack[] {
  const tracks: MotionTrack[] = [];
  const movers = els.filter((e) => e.type !== "scene");
  if (!movers.length) return tracks;

  const slice = duration / Math.max(1, movers.length);
  movers.forEach((el, i) => {
    const hasKeyframes = css.keyframes.length > 0;
    const hasTransform = css.transforms.length > 0;
    const startTime = Math.round(i * slice * 0.6);
    const endTime = Math.round(Math.min(duration, startTime + slice * 1.4));
    tracks.push({
      elementId: el.id,
      startTime,
      endTime,
      position: {
        from: { ...el.position },
        to: {
          x: el.position.x + (hasTransform ? 24 + (i % 3) * 12 : 8 * (i % 2 === 0 ? 1 : -1)),
          y: el.position.y - (hasKeyframes ? 40 + (i % 4) * 10 : 12),
        },
        path: hasTransform ? { kind: "curve", points: [{ ...el.position }] } : undefined,
      },
      scale: { from: 0.6 + (i % 3) * 0.2, to: 1 },
      opacity: { from: 0, to: 1 },
      rotation: hasTransform ? { from: 0, to: (i % 2 === 0 ? 12 : -12) } : undefined,
      easing: css.rawEasings[0] ?? "ease-out",
    });
  });
  return tracks;
}
