import { Brain, type BrainDeps } from "../core/brain/Brain";

let singleton: Brain | null = null;

export function createBrain(deps: BrainDeps = {}): Brain {
  return new Brain(deps);
}

export function getBrain(deps: BrainDeps = {}): Brain {
  if (!singleton) singleton = new Brain(deps);
  return singleton;
}

export async function runBrain(goal: string, deps?: BrainDeps): Promise<string> {
  return getBrain(deps).chat(goal);
}
