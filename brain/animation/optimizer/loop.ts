// Self-improvement loop (§15): ANALYZE → RENDER → COMPARE → MODIFY ADL →
// REGENERATE → COMPARE AGAIN. Stops on target / budget / no-improvement.
// Never loops endlessly: maxIterations is always bounded.
import type { ADL, FrameSample, OptimizeOptions, OptimizeResult } from "../types";
import { renderAdlFrames } from "../reconstruction/engine";
import { compareFrames } from "../visual-comparator/comparator";

export type RenderFn = (adl: ADL) => FrameSample[];
export type MutateFn = (adl: ADL, report: ReturnType<typeof compareFrames>) => { adl: ADL; changes: string[] };

/** Default mutation: nudge the weakest metric's events toward the original. */
export function defaultMutate(adl: ADL, report: ReturnType<typeof compareFrames>): { adl: ADL; changes: string[] } {
  const next: ADL = JSON.parse(JSON.stringify(adl)) as ADL;
  const weakest = [...report.metrics].sort((a, b) => a.score - b.score)[0];
  const changes: string[] = [];
  if (!weakest || weakest.score >= 95) return { adl: next, changes: ["no significant weakness — no change"] };
  if (weakest.name === "Timing") {
    for (const e of next.events) e.duration = Math.round(e.duration * 1.08);
    next.duration = Math.round(next.duration * 1.08);
    changes.push("lengthened durations +8% to fix Timing");
  } else if (weakest.name === "Scale" || weakest.name === "Position") {
    for (const e of next.events) e.easing = "easeOut";
    changes.push(`normalized easing to easeOut to fix ${weakest.name}`);
  } else if (weakest.name === "Opacity") {
    changes.push("opacity already boundary-clamped — tightened fade windows");
    for (const e of next.events) {
      if (e.action === "fade-in") e.duration = Math.max(200, Math.round(e.duration * 0.92));
    }
  } else {
    for (const e of next.events) e.duration = Math.round(e.duration * 1.03);
    next.duration = Math.round(next.duration * 1.03);
    changes.push(`fine-tuned durations +3% to fix ${weakest.name}`);
  }
  return { adl: next, changes };
}

export function optimize(
  original: FrameSample[],
  initialAdl: ADL,
  opts: OptimizeOptions = {},
  render: RenderFn = (a) => renderAdlFrames(a),
  mutate: MutateFn = defaultMutate,
): OptimizeResult {
  const target = opts.targetSimilarity ?? 90;
  const max = Math.max(1, Math.min(25, opts.maxIterations ?? 6));
  const minGain = opts.minImprovement ?? 0.5;

  let current = initialAdl;
  let best = current;
  let bestScore = -1;
  const iterations: OptimizeResult["iterations"] = [];
  let prevScore = -1;

  for (let i = 1; i <= max; i++) {
    const frames = render(current);
    const report = compareFrames(original, frames);
    if (report.similarity > bestScore) {
      bestScore = report.similarity;
      best = current;
    }
    iterations.push({ iteration: i, similarity: report.similarity, changes: i === 1 ? ["initial render"] : (iterations[iterations.length - 1]?.changes ?? []), adl: current });

    if (report.similarity >= target) {
      return { finalAdl: current, finalReport: report, iterations, stoppedBecause: "target-reached" };
    }
    if (prevScore >= 0 && report.similarity - prevScore < minGain) {
      return { finalAdl: best, finalReport: compareFrames(original, render(best)), iterations, stoppedBecause: "no-improvement" };
    }
    prevScore = report.similarity;
    const m = mutate(current, report);
    iterations[iterations.length - 1].changes = m.changes;
    current = m.adl;
  }
  const finalReport = compareFrames(original, render(best));
  return { finalAdl: best, finalReport, iterations, stoppedBecause: "budget-exhausted" };
}
