// Central type definitions for the AI Brain. Single source of truth.
export type Complexity = "simple" | "medium" | "complex";
export type RiskLevel = "low" | "medium" | "high";
export type MemoryScope =
  | "short-term" | "episodic" | "semantic" | "user" | "project" | "agent" | "codebase";
export type InputType =
  | "text" | "image" | "document" | "code" | "url" | "structured" | "tool-result" | "history";

export interface ContextItem {
  id: string;
  role: "user" | "assistant" | "system" | "tool" | "memory" | "knowledge";
  content: string;
  tokens: number;
  timestamp: number;
  importance: number; // 0..1
  source?: string;
}

export interface TaskContext {
  id: string;
  userInput: string;
  normalizedInput: string;
  inputType: InputType;
  intent: string;
  complexity: Complexity;
  constraints: string[];
  requiredCapabilities: string[];
  context: ContextItem[];
  toolsRequired: string[];
  entities: string[];
  language: string;
  createdAt: number;
}

export interface CognitiveState {
  goal: string;
  currentStep: string;
  knownFacts: string[];
  assumptions: string[];
  uncertainties: string[];
  constraints: string[];
  availableTools: string[];
  observations: string[];
  previousActions: Action[];
  nextActions: Action[];
  confidence: number;
  updatedAt: number;
}

export interface Action {
  id: string;
  kind: "model_call" | "tool_call" | "memory_op" | "user_message" | "plan_step";
  name: string;
  input: unknown;
  output?: unknown;
  status: "pending" | "running" | "succeeded" | "failed" | "skipped";
  startedAt?: number;
  endedAt?: number;
  error?: string;
}

export interface SubTask {
  id: string;
  title: string;
  description: string;
  priority: number; // lower = higher priority
  dependencies: string[]; // subtask ids
  parallelizable: boolean;
  status: "pending" | "running" | "succeeded" | "failed" | "skipped";
  attempts: number;
  maxRetries: number;
  result?: unknown;
  error?: string;
}

export interface TaskPlan {
  id: string;
  goal: string;
  subtasks: SubTask[];
  createdAt: number;
}

export interface ReasoningState {
  hypotheses: string[];
  evidence: string[];
  constraints: string[];
  candidateActions: string[];
  selectedAction: string | null;
  confidence: number;
}

export interface MemoryRecord {
  id: string;
  scope: MemoryScope;
  content: string;
  embedding: number[];
  metadata: Record<string, unknown>;
  importance: number; // 0..1
  createdAt: number;
  lastAccessedAt: number;
  accessCount: number;
}

export interface MemoryQuery {
  text: string;
  scopes?: MemoryScope[];
  topK?: number;
  minScore?: number;
  metadataFilter?: Record<string, unknown>;
}

export interface RankedMemory extends MemoryRecord {
  score: number;
}

export interface ModelCapabilities {
  reasoning: boolean;
  coding: boolean;
  vision: boolean;
  longContext: boolean;
  tools: boolean;
  lowLatency: boolean;
  lowCost: boolean;
}

export interface ModelSpec {
  id: string;
  provider: string;
  model: string;
  capabilities: ModelCapabilities;
  contextWindow: number;
  costPer1kInput: number; // USD
  costPer1kOutput: number;
  avgLatencyMs: number;
  quality: number; // 0..1
  enabled: boolean;
}

export interface ModelRequest {
  messages: Array<{ role: string; content: string }>;
  maxTokens?: number;
  temperature?: number;
  tools?: ToolDefinition[];
  timeoutMs?: number;
  tags?: string[];
}

export interface ModelResponse {
  text: string;
  inputTokens: number;
  outputTokens: number;
  modelId: string;
  latencyMs: number;
  finishReason: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  capabilities: string[];
  inputSchema: unknown;
  outputSchema: unknown;
  riskLevel: RiskLevel;
}

export interface ToolCallResult {
  toolName: string;
  success: boolean;
  output: unknown;
  latencyMs: number;
  error?: string;
}

export interface EvaluationResult {
  completeness: number;
  correctness: number;
  requirementCoverage: number;
  needsRevision: boolean;
  issues: string[];
  suggestedNextAction?: string;
}

export interface BrainRunInput {
  goal: string;
  attachments?: Array<{ type: InputType; content: string; name?: string }>;
  constraints?: string[];
  maxSteps?: number;
  budgetUsd?: number;
}

export interface BrainResult {
  response: string;
  taskId: string;
  plan: TaskPlan | null;
  actions: Action[];
  evaluation: EvaluationResult | null;
  tokensUsed: { input: number; output: number };
  estimatedCostUsd: number;
  modelUsed: string;
  fallbacks: number;
  sources: Array<{ uri: string; label: string }>;
  durationMs: number;
}

export interface BrainEvents {
  taskStarted: { taskId: string; goal: string };
  taskFinished: { taskId: string; success: boolean };
  modelSelected: { modelId: string; reason: string };
  modelFallback: { from: string; to: string; error: string };
  toolCall: { tool: string; success: boolean; latencyMs: number };
  memoryRetrieved: { count: number; query: string };
  evaluation: EvaluationResult;
  error: { where: string; message: string };
}
