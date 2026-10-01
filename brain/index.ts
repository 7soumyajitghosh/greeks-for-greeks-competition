// brain/index.ts — ONE unified AI Brain entry point.
// Animation Brain + Human-Like Coding Brain + Autonomous Loop + Memory +
// Reasoning + Agents + Tools + Model Router = ONE unified "brain/".
export * from "./core/types";
export { Brain, type BrainDeps } from "./core/brain/Brain";
export { UnifiedBrain, getUnifiedBrain, createUnifiedBrain } from "./core/brain";
export { BrainOrchestrator, getOrchestrator, routeCapability } from "./core/orchestrator";
export { runBrainLoop } from "./core/brain-loop";
export * from "./core/task-state";
export * from "./core/cognitive-state";
export { CodingBrain } from "./coding/CodingBrain";
export { AnimationBrain } from "./animation/api/brain";
export { runAnimationLoop } from "./loops/animation-loop/loop";
export { runAutonomousLoop } from "./loops/autonomous-loop/loop";
export { runBuildLoop } from "./loops/build-loop/loop";
export { runTestLoop } from "./loops/test-loop/loop";
export { runDebugLoop } from "./loops/debug-loop/loop";
export { runImprovementLoop } from "./loops/improvement-loop/loop";
export { loadConfig, defaultModels } from "./config/defaults";
export { getBrain, createBrain, runBrain } from "./api/index";
