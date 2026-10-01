// Improvement loop: REVIEW ? OPTIMIZE ? VERIFY.
import { Brain } from "../../core/brain/Brain";
export async function runImprovementLoop(brain: Brain, goal: string, candidate: string, iterations = 2) {
  let current = candidate;
  for (let i = 0; i < iterations; i++) {
    const ev = brain.evaluateResult(goal, current);
    if (!ev.needsRevision) return { result: current, evaluation: ev, iterations: i };
    const next = await brain.run({ goal: `Improve (pass ${i + 1}): ${ev.suggestedNextAction ?? ev.issues.join("; ")}. Goal: ${goal}`, maxSteps: 4 });
    current = next.response;
  }
  return { result: current, evaluation: brain.evaluateResult(goal, current), iterations };
}
