export type LogLevel = "debug" | "info" | "warn" | "error";
type Handler = (event: string, payload: unknown) => void;

const LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

export interface MetricSnapshot {
  tasksStarted: number;
  tasksFinished: number;
  toolCalls: number;
  toolErrors: number;
  fallbacks: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  errors: Array<{ where: string; message: string; at: number }>;
  latenciesMs: number[];
  recentEvents: Array<{ event: string; at: number; payload: unknown }>;
}

export class Observability {
  private handlers = new Set<Handler>();
  private level: LogLevel = "info";
  private metrics: MetricSnapshot = {
    tasksStarted: 0, tasksFinished: 0, toolCalls: 0, toolErrors: 0,
    fallbacks: 0, inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0,
    errors: [], latenciesMs: [], recentEvents: [],
  };

  constructor(level: LogLevel = "info") { this.level = level; }

  setLevel(l: LogLevel): void { this.level = l; }
  on(h: Handler): () => void { this.handlers.add(h); return () => { this.handlers.delete(h); }; }

  private shouldLog(l: LogLevel): boolean { return LEVELS[l] >= LEVELS[this.level]; }

  log(level: LogLevel, event: string, payload: unknown = {}): void {
    if (!this.shouldLog(level)) return;
    const entry = { event, at: Date.now(), payload };
    this.metrics.recentEvents.push(entry);
    if (this.metrics.recentEvents.length > 200) this.metrics.recentEvents.shift();
    if (event === "error") {
      const p = payload as { where?: string; message?: string };
      this.metrics.errors.push({ where: String(p?.where ?? "?"), message: String(p?.message ?? "error"), at: Date.now() });
    }
    for (const h of this.handlers) {
      try { h(event, payload); } catch { /* never break brain on observer */ }
    }
    const line = `[brain:${level}] ${event}`;
    if (level === "error") console.error(line, payload);
    else if (level === "warn") console.warn(line, payload);
    else if (this.level === "debug") console.debug(line, payload);
  }

  recordTokens(input: number, output: number, costUsd: number, latencyMs: number): void {
    this.metrics.inputTokens += input;
    this.metrics.outputTokens += output;
    this.metrics.estimatedCostUsd += costUsd;
    this.metrics.latenciesMs.push(latencyMs);
    if (this.metrics.latenciesMs.length > 500) this.metrics.latenciesMs.shift();
  }
  inc(key: "tasksStarted" | "tasksFinished" | "toolCalls" | "toolErrors" | "fallbacks"): void {
    this.metrics[key] += 1;
  }

  snapshot(): MetricSnapshot {
    return JSON.parse(JSON.stringify(this.metrics)) as MetricSnapshot;
  }

  // Dashboard-safe summary (no secrets, no raw prompts beyond counts)
  dashboard(): Record<string, unknown> {
    const m = this.metrics;
    const avgLatency = m.latenciesMs.length
      ? Math.round(m.latenciesMs.reduce((a, b) => a + b, 0) / m.latenciesMs.length) : 0;
    return {
      activeTasks: m.tasksStarted - m.tasksFinished,
      tasksStarted: m.tasksStarted,
      tasksFinished: m.tasksFinished,
      toolCalls: m.toolCalls,
      toolErrors: m.toolErrors,
      fallbacks: m.fallbacks,
      inputTokens: m.inputTokens,
      outputTokens: m.outputTokens,
      estimatedCostUsd: Number(m.estimatedCostUsd.toFixed(6)),
      avgLatencyMs: avgLatency,
      errors: m.errors.slice(-10),
      recentEvents: m.recentEvents.slice(-25).map((e) => ({ event: e.event, at: e.at })),
    };
  }
}
