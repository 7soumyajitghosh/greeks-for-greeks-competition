// Spec: brain/core/cognitive-state.ts — single re-export point for cognitive state.
export {
  createInitialState,
  recordAction,
  updateState,
  nextActionId,
} from "./state/CognitiveState";
export type { CognitiveState, Action } from "./types";
