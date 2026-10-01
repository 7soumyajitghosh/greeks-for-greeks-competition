// Build loop: PLAN ? BUILD ? RUN ? VERIFY (subset of autonomous loop).
import { Brain } from "../../core/brain/Brain";
export async function runBuildLoop(brain: Brain, goal: string) {
  const plan = await brain.plan(goal);
  const built = await brain.run({ goal: `Build: ${goal}`, maxSteps: 6 });
  return { plan, built };
}
