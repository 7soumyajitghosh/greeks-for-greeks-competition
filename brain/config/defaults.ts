export interface BrainConfig {
  defaultProvider: string;
  models: import("../core/types").ModelSpec[];
  maxSteps: number;
  maxTokensPerCall: number;
  tokenBudgetPerTask: number;
  costBudgetUsdPerTask: number;
  requestTimeoutMs: number;
  maxRetries: number;
  memoryTopK: number;
  enableSecurity: boolean;
  enableEvaluation: boolean;
  logLevel: "debug" | "info" | "warn" | "error";
}

function num(v: string | undefined, d: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

export function loadConfig(): BrainConfig {
  const env = (typeof process !== "undefined" ? process.env ?? {} : {}) as Record<string, string | undefined>;
  // import.meta.env support for Vite
  const viteEnv = (() => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const m = (import.meta as any)?.env as Record<string, string> | undefined;
      return m ?? {};
    } catch { return {}; }
  })();
  const get = (k: string) => env[k] ?? viteEnv[k] ?? viteEnv[`VITE_${k}`];
  return {
    defaultProvider: get("BRAIN_DEFAULT_PROVIDER") ?? "mock",
    models: defaultModels(),
    maxSteps: num(get("BRAIN_MAX_STEPS"), 12),
    maxTokensPerCall: num(get("BRAIN_MAX_TOKENS_PER_CALL"), 2000),
    tokenBudgetPerTask: num(get("BRAIN_TOKEN_BUDGET"), 32000),
    costBudgetUsdPerTask: Number(get("BRAIN_COST_BUDGET_USD") ?? 0.5),
    requestTimeoutMs: num(get("BRAIN_REQUEST_TIMEOUT_MS"), 30000),
    maxRetries: num(get("BRAIN_MAX_RETRIES"), 2),
    memoryTopK: num(get("BRAIN_MEMORY_TOPK"), 6),
    enableSecurity: (get("BRAIN_ENABLE_SECURITY") ?? "true") !== "false",
    enableEvaluation: (get("BRAIN_ENABLE_EVAL") ?? "true") !== "false",
    logLevel: ((get("BRAIN_LOG_LEVEL") ?? "info") as BrainConfig["logLevel"]),
  };
}

export function defaultModels(): BrainConfig["models"] {
  return [
    { id: "mock-fast", provider: "mock", model: "mock-fast", capabilities: { reasoning: false, coding: false, vision: false, longContext: false, tools: true, lowLatency: true, lowCost: true }, contextWindow: 8000, costPer1kInput: 0, costPer1kOutput: 0, avgLatencyMs: 200, quality: 0.6, enabled: true },
    { id: "mock-reasoner", provider: "mock", model: "mock-reasoner", capabilities: { reasoning: true, coding: true, vision: false, longContext: true, tools: true, lowLatency: false, lowCost: false }, contextWindow: 32000, costPer1kInput: 0, costPer1kOutput: 0, avgLatencyMs: 1200, quality: 0.85, enabled: true },
    { id: "openai-gpt-4o-mini", provider: "openai", model: "gpt-4o-mini", capabilities: { reasoning: false, coding: true, vision: true, longContext: false, tools: true, lowLatency: true, lowCost: true }, contextWindow: 128000, costPer1kInput: 0.00015, costPer1kOutput: 0.0006, avgLatencyMs: 900, quality: 0.78, enabled: false },
    { id: "openai-gpt-4o", provider: "openai", model: "gpt-4o", capabilities: { reasoning: true, coding: true, vision: true, longContext: true, tools: true, lowLatency: false, lowCost: false }, contextWindow: 128000, costPer1kInput: 0.0025, costPer1kOutput: 0.01, avgLatencyMs: 1800, quality: 0.92, enabled: false },
    { id: "anthropic-claude-haiku", provider: "anthropic", model: "claude-3-haiku", capabilities: { reasoning: false, coding: true, vision: true, longContext: true, tools: true, lowLatency: true, lowCost: true }, contextWindow: 200000, costPer1kInput: 0.00025, costPer1kOutput: 0.00125, avgLatencyMs: 800, quality: 0.8, enabled: false },
    { id: "gemini-flash", provider: "google", model: "gemini-flash", capabilities: { reasoning: false, coding: true, vision: true, longContext: true, tools: true, lowLatency: true, lowCost: true }, contextWindow: 1000000, costPer1kInput: 0.0001, costPer1kOutput: 0.0004, avgLatencyMs: 700, quality: 0.79, enabled: false },
  ];
}
