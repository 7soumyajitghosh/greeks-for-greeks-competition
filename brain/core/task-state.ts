// Spec: brain/core/task-state.ts — task lifecycle state machine.
// OBSERVE → UNDERSTAND → PLAN → BUILD → RUN → TEST → ANALYZE → FIX → RETEST → REVIEW → OPTIMIZE → VERIFY
import { nextActionId } from "./state/CognitiveState";
import type { Action, TaskPlan } from "./types";

export type TaskPhase =
  | "observe" | "understand" | "plan" | "build" | "run" | "test"
  | "analyze" | "fix" | "retest" | "review" | "optimize" | "verify" | "done" | "failed";

export const TASK_PHASES: TaskPhase[] = [
  "observe", "understand", "plan", "build", "run", "test",
  "analyze", "fix", "retest", "review", "optimize", "verify",
];

export interface TaskState {
  id: string;
  goal: string;
  phase: TaskPhase;
  plan: TaskPlan | null;
  actions: Action[];
  attempts: number;
  maxAttempts: number;
  errors: string[];
  result?: unknown;
  startedAt: number;
  updatedAt: number;
}

export function createTaskState(goal: string, maxAttempts = 3): TaskState {
  const now = Date.now();
  return {
    id: `task_${now.toString(36)}`,
    goal, phase: "observe", plan: null, actions: [],
    attempts: 0, maxAttempts, errors: [], startedAt: now, updatedAt: now,
  };
}

export function advancePhase(s: TaskState, phase: TaskPhase): TaskState {
  return { ...s, phase, updatedAt: Date.now() };
}

export function recordTaskAction(s: TaskState, name: string, output?: unknown, status: Action["status"] = "succeeded", error?: string): TaskState {
  const action: Action = {
    id: nextActionId(), kind: "plan_step", name, input: { phase: s.phase },
    output, status, startedAt: s.updatedAt, endedAt: Date.now(), error,
  };
  return { ...s, actions: [...s.actions, action], updatedAt: Date.now() };
}

export function recordTaskError(s: TaskState, error: string): TaskState {
  return { ...s, errors: [...s.errors, error], attempts: s.attempts + 1, updatedAt: Date.now() };
}

export function isTerminal(s: TaskState): boolean {
  return s.phase === "done" || s.phase === "failed";
}
