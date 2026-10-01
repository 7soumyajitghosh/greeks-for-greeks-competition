// Animation agent loop (§19):
// OBSERVE → UNDERSTAND → REPRESENT → RECREATE → RENDER → COMPARE →
// DIAGNOSE → MODIFY → RENDER AGAIN → COMPARE AGAIN → OPTIMIZE → VERIFY
import type { ADL, AgentStep, ComparisonReport, UnderstandingResult } from "../types";

export type AgentHooks = {
  observe?: () => Promise<void> | void;
  understand?: () => Promise<UnderstandingResult> | UnderstandingResult;
  represent?: (u: UnderstandingResult) => Promise<ADL> | ADL;
  recreate?: (adl: ADL) => Promise<void> | void;
  render?: (adl: ADL) => Promise<void> | void;
  compare?: (adl: ADL) => Promise<ComparisonReport> | ComparisonReport;
  diagnose?: (r: ComparisonReport) => Promise<string[]> | string[];
  modify?: (adl: ADL, diagnosis: string[]) => Promise<ADL> | ADL;
  optimize?: (adl: ADL) => Promise<ADL> | ADL;
  verify?: (adl: ADL, r: ComparisonReport) => Promise<boolean> | boolean;
};

const PHASES = [
  "OBSERVE",
  "UNDERSTAND",
  "REPRESENT",
  "RECREATE",
  "RENDER",
  "COMPARE",
  "DIAGNOSE",
  "MODIFY",
  "RENDER_AGAIN",
  "COMPARE_AGAIN",
  "OPTIMIZE",
  "VERIFY",
] as const;

export async function runAgentLoop(hooks: AgentHooks): Promise<{ steps: AgentStep[]; verified: boolean }> {
  const steps: AgentStep[] = [];
  const mark = (phase: string, detail: string): void => {
    steps.push({ phase, detail, at: Date.now() });
  };

  await hooks.observe?.();
  mark("OBSERVE", "input captured");
  const understanding = await hooks.understand?.();
  mark("UNDERSTAND", understanding ? `${understanding.objects.length} objects, ${understanding.timeline.length} events` : "no understanding hook");
  const adl = understanding && hooks.represent ? await hooks.represent(understanding) : undefined;
  mark("REPRESENT", adl ? `ADL ${adl.scene} (${adl.events.length} events)` : "no ADL");
  if (adl && hooks.recreate) {
    await hooks.recreate(adl);
    mark("RECREATE", "reconstruction generated");
  }
  if (adl && hooks.render) {
    await hooks.render(adl);
    mark("RENDER", "first render complete");
  }
  let report: ComparisonReport | undefined;
  if (adl && hooks.compare) {
    report = await hooks.compare(adl);
    mark("COMPARE", `similarity ${report.similarity}%`);
  }
  let diagnosis: string[] = [];
  if (report && hooks.diagnose) {
    diagnosis = await hooks.diagnose(report);
    mark("DIAGNOSE", diagnosis.join("; ") || "no issues");
  }
  let current = adl;
  if (current && hooks.modify) {
    current = await hooks.modify(current, diagnosis);
    mark("MODIFY", "ADL updated from diagnosis");
  }
  if (current && hooks.render) {
    await hooks.render(current);
    mark("RENDER_AGAIN", "second render complete");
  }
  if (current && hooks.compare) {
    report = await hooks.compare(current);
    mark("COMPARE_AGAIN", `similarity ${report.similarity}%`);
  }
  if (current && hooks.optimize) {
    current = await hooks.optimize(current);
    mark("OPTIMIZE", "optimization pass complete");
  }
  let verified = false;
  if (current && report && hooks.verify) {
    verified = await hooks.verify(current, report);
    mark("VERIFY", verified ? "verified" : "below threshold");
  } else {
    mark("VERIFY", "skipped (no verify hook)");
  }
  void PHASES;
  return { steps, verified };
}
