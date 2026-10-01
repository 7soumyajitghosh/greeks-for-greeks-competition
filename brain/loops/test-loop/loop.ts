// Test loop: RUN ? TEST ? RETEST.
import { Brain } from "../../core/brain/Brain";
export async function runTestLoop(brain: Brain, goal: string, candidate: string) {
  const first = brain.evaluateResult(goal, candidate);
  if (!first.needsRevision) return { evaluation: first, revised: candidate };
  const fixed = await brain.run({ goal: `Fix: ${first.issues.join("; ")}. Goal: ${goal}`, maxSteps: 4 });
  return { evaluation: brain.evaluateResult(goal, fixed.response), revised: fixed.response };
}
