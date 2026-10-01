import type { ModelRequest, ModelResponse, ModelSpec } from "../../core/types";

export interface ModelProvider {
  readonly providerName: string;
  isConfigured(): boolean;
  complete(spec: ModelSpec, req: ModelRequest): Promise<ModelResponse>;
}

function env(key: string): string | undefined {
  try {
    const p = (typeof process !== "undefined" ? process.env?.[key] : undefined) as string | undefined;
    if (p) return p;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (import.meta as any)?.env?.[key] ?? (import.meta as any)?.env?.[`VITE_${key}`];
  } catch { return undefined; }
}

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, rej) => {
    timer = setTimeout(() => rej(new Error(`Model request timed out after ${ms}ms`)), ms);
  });
  try { return await Promise.race([p, timeout]); }
  finally { clearTimeout(timer!); }
}

// Deterministic offline provider so the Brain works with zero API keys.
// Produces a structured, useful answer from the prompt without calling the network.
export class MockProvider implements ModelProvider {
  readonly providerName = "mock";
  isConfigured(): boolean { return true; }
  async complete(spec: ModelSpec, req: ModelRequest): Promise<ModelResponse> {
    const start = Date.now();
    await new Promise((r) => setTimeout(r, Math.min(150, spec.avgLatencyMs / 8)));
    const lastUser = [...req.messages].reverse().find((m) => m.role === "user" || m.role === "system");
    const prompt = lastUser?.content ?? req.messages.map((m) => m.content).join("\n").slice(-3000);
    const text = mockAnswer(prompt, spec);
    const inputTokens = Math.ceil(req.messages.map((m) => m.content).join("").length / 4);
    const outputTokens = Math.ceil(text.length / 4);
    return { text, inputTokens, outputTokens, modelId: spec.id, latencyMs: Date.now() - start, finishReason: "stop" };
  }
}

function mockAnswer(prompt: string, spec: ModelSpec): string {
  const goal = prompt.slice(0, 1500);
  const head = spec.capabilities.reasoning ? "Analysis + plan" : "Answer";
  return [
    `## ${head}`,
    ``,
    `Based on the request below, here is a structured response from \`${spec.id}\`:`,
    ``,
    `**Request excerpt:** ${goal.slice(0, 400)}${goal.length > 400 ? "…" : ""}`,
    ``,
    `**Approach**`,
    `1. Clarified the goal and constraints.`,
    `2. Broke the work into verifiable steps.`,
    `3. Produced the result below; verify against your acceptance criteria.`,
    ``,
    `**Result**`,
    `- If this was a build task: scaffold the modules first, then wire auth → data → API → tests → deploy.`,
    `- If this was a question: the key factors are requirements, trade-offs, and verification steps.`,
    `- Adapt the steps to your repo; run tests after each change.`,
    ``,
    `_Generated offline by the mock provider (no API key configured). Connect a real provider via env keys to upgrade quality._`,
  ].join("\n");
}

// OpenAI-compatible chat completions (works for OpenAI, DeepSeek, Qwen, Mistral, Moonshot, Zhipu, NVIDIA, xAI with baseURL override).
export class OpenAICompatibleProvider implements ModelProvider {
  readonly providerName = "openai";
  constructor(private apiKey?: string, private baseURL = "https://api.openai.com/v1") {
    this.apiKey = apiKey ?? env("OPENAI_API_KEY");
    const custom = env("OPENAI_BASE_URL");
    if (custom) this.baseURL = custom;
  }
  isConfigured(): boolean { return !!this.apiKey; }
  async complete(spec: ModelSpec, req: ModelRequest): Promise<ModelResponse> {
    const start = Date.now();
    const res = await withTimeout(fetch(`${this.baseURL}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({
        model: spec.model,
        messages: req.messages,
        max_tokens: req.maxTokens ?? 1500,
        temperature: req.temperature ?? 0.4,
      }),
    }), req.timeoutMs ?? 30000);
    if (res.status === 429) throw Object.assign(new Error("Rate limited (429)"), { retryable: true, code: 429 });
    if (res.status >= 500) throw Object.assign(new Error(`Provider 5xx: ${res.status}`), { retryable: true, code: res.status });
    if (!res.ok) throw new Error(`Provider error ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data = await res.json() as { choices?: Array<{ message?: { content?: string } }>; usage?: { prompt_tokens?: number; completion_tokens?: number } };
    const text = data.choices?.[0]?.message?.content ?? "";
    return {
      text,
      inputTokens: data.usage?.prompt_tokens ?? 0,
      outputTokens: data.usage?.completion_tokens ?? 0,
      modelId: spec.id,
      latencyMs: Date.now() - start,
      finishReason: "stop",
    };
  }
}

export class AnthropicProvider implements ModelProvider {
  readonly providerName = "anthropic";
  constructor(private apiKey?: string) { this.apiKey = apiKey ?? env("ANTHROPIC_API_KEY"); }
  isConfigured(): boolean { return !!this.apiKey; }
  async complete(spec: ModelSpec, req: ModelRequest): Promise<ModelResponse> {
    const start = Date.now();
    const system = req.messages.filter((m) => m.role === "system").map((m) => m.content).join("\n");
    const messages = req.messages.filter((m) => m.role !== "system").map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content }));
    const res = await withTimeout(fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": this.apiKey ?? "", "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: spec.model, max_tokens: req.maxTokens ?? 1500, system: system || undefined, messages }),
    }), req.timeoutMs ?? 30000);
    if (res.status === 429) throw Object.assign(new Error("Rate limited (429)"), { retryable: true, code: 429 });
    if (!res.ok) throw new Error(`Anthropic error ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data = await res.json() as { content?: Array<{ text?: string }>; usage?: { input_tokens?: number; output_tokens?: number } };
    const text = data.content?.map((c) => c.text ?? "").join("") ?? "";
    return { text, inputTokens: data.usage?.input_tokens ?? 0, outputTokens: data.usage?.output_tokens ?? 0, modelId: spec.id, latencyMs: Date.now() - start, finishReason: "stop" };
  }
}

export class GoogleProvider implements ModelProvider {
  readonly providerName = "google";
  constructor(private apiKey?: string) { this.apiKey = apiKey ?? env("GOOGLE_API_KEY") ?? env("GEMINI_API_KEY"); }
  isConfigured(): boolean { return !!this.apiKey; }
  async complete(spec: ModelSpec, req: ModelRequest): Promise<ModelResponse> {
    const start = Date.now();
    const prompt = req.messages.map((m) => `${m.role}: ${m.content}`).join("\n");
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${spec.model}:generateContent?key=${this.apiKey}`;
    const res = await withTimeout(fetch(url, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: req.maxTokens ?? 1500 } }),
    }), req.timeoutMs ?? 30000);
    if (res.status === 429) throw Object.assign(new Error("Rate limited (429)"), { retryable: true, code: 429 });
    if (!res.ok) throw new Error(`Google error ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data = await res.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>; usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number } };
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    return { text, inputTokens: data.usageMetadata?.promptTokenCount ?? 0, outputTokens: data.usageMetadata?.candidatesTokenCount ?? 0, modelId: spec.id, latencyMs: Date.now() - start, finishReason: "stop" };
  }
}
