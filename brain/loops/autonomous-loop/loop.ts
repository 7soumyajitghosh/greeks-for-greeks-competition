// Spec: brain/loops/autonomous-loop — OBSERVE?UNDERSTAND?PLAN?BUILD?RUN?TEST?ANALYZE?FIX?RETEST?REVIEW?OPTIMIZE?VERIFY
export { runBrainLoop, type LoopOptions } from "../../core/brain-loop";
export type { TaskState, TaskPhase } from "../../core/task-state";
import { Brain } from "../../core/brain/Brain";
import { runBrainLoop } from "../../core/brain-loop";
export function runAutonomousLoop(brain: Brain, goal: string) { return runBrainLoop(brain, goal); }
