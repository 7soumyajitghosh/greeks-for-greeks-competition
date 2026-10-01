// Debug loop: ANALYZE -> FIND PROBLEM -> FIX -> RETEST.
import { BugAnalysisEngine } from "../../coding/bugs/BugAnalysisEngine";
export async function runDebugLoop(code: string, error: string) {
  const engine = new BugAnalysisEngine();
  const analysis = engine.diagnose(`${error}\n${code}`, [], new Map());
  return { analysis, hypothesis: analysis.rootCause ?? null };
}
