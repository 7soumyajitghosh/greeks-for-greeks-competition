import type { Action, CognitiveState } from "../types";

let seq = 0;

export function createInitialState(goal: string, constraints: string[], availableTools: string[]): CognitiveState {
  return {
    goal,
    currentStep: "initialized",
    knownFacts: [],
    assumptions: [],
    uncertainties: [],
    constraints: [...constraints],
    availableTools: [...availableTools],
    observations: [],
    previousActions: [],
    nextActions: [],
    confidence: 0.3,
    updatedAt: Date.now(),
  };
}

export function recordAction(state: CognitiveState, action: Action): CognitiveState {
  return {
    ...state,
    previousActions: [...state.previousActions.slice(-49), action],
    currentStep: action.name,
    observations: action.output !== undefined
      ? [...state.observations.slice(-49), `${action.name}: ${String(action.output).slice(0, 300)}`]
      : state.observations,
    updatedAt: Date.now(),
  };
}

export function updateState(state: CognitiveState, patch: Partial<CognitiveState>): CognitiveState {
  return { ...state, ...patch, updatedAt: Date.now() };
}

export function nextActionId(): string {
  return `act_${Date.now().toString(36)}_${(seq++).toString(36)}`;
}
