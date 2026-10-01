// Unified Brain core entry (spec: brain/core/brain.ts).
// Re-exports the preserved Brain implementation and exposes UnifiedBrain,
// the single orchestrator composing ALL capabilities through shared services.
export { Brain, type BrainDeps } from "./brain/Brain";
export * from "./types";

import { Brain, type BrainDeps } from "./brain/Brain";
import { AnimationBrain } from "../animation/api/brain";
import { loadConfig, type BrainConfig } from "../config/defaults";

export interface UnifiedBrainDeps extends BrainDeps {
  animationBrain?: AnimationBrain;
}

export class UnifiedBrain {
  readonly brain: Brain;
  readonly animation: AnimationBrain;
  readonly config: BrainConfig;

  constructor(deps: UnifiedBrainDeps = {}) {
    this.brain = new Brain(deps);
    this.animation = deps.animationBrain ?? new AnimationBrain();
    this.config = deps.config ?? loadConfig();
  }

  // Shared services — single instances used by coding AND animation brains.
  get memory() { return this.brain.memory; }
  get tools() { return this.brain.tools; }
  get gateway() { return this.brain.gateway; }
  get security() { return this.brain.security; }
  get obs() { return this.brain.obs; }
  get codebase() { return this.brain.codebase; }
  get rag() { return this.brain.rag; }

  run = (input: Parameters<Brain["run"]>[0]) => this.brain.run(input);
  chat = (msg: string) => this.brain.chat(msg);
  plan = (goal: string) => this.brain.plan(goal);
  reason = (task: string, c: string[] = []) => this.brain.reason(task, c);
  remember = (d: string, s?: Parameters<Brain["remember"]>[1]) => this.brain.remember(d, s);
  retrieve = (q: string, k = 6) => this.brain.retrieve(q, k);
  dashboard = () => ({
    ...this.brain.dashboard(),
    animationPatterns: this.animation.memory.list().length,
  });

  analyzeAnimation = (input: string, mime?: string) => this.animation.analyze(input, mime);
  recreateAnimation = (input: string, mime?: string) => this.animation.recreate(input, mime);
}

let singleton: UnifiedBrain | null = null;
export function getUnifiedBrain(deps: UnifiedBrainDeps = {}): UnifiedBrain {
  if (!singleton) singleton = new UnifiedBrain(deps);
  return singleton;
}
export function createUnifiedBrain(deps: UnifiedBrainDeps = {}): UnifiedBrain {
  return new UnifiedBrain(deps);
}
