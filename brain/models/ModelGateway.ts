import type { ModelRequest, ModelResponse, ModelSpec } from "../core/types";
import type { ModelProvider } from "./providers/providers";
import { AnthropicProvider, GoogleProvider, MockProvider, OpenAICompatibleProvider } from "./providers/providers";

export class ProviderHealthTracker {
  private failures = new Map<string, { count: number; lastFailure: number; cooldownUntil: number }>();
  recordSuccess(modelId: string): void { this.failures.delete(modelId); }
  recordFailure(modelId: string): void {
    const cur = this.failures.get(modelId) ?? { count: 0, lastFailure: 0, cooldownUntil: 0 };
    const count = cur.count + 1;
    const cooldownMs = Math.min(5 * 60_000, 2000 * 2 ** Math.min(count, 6));
    this.failures.set(modelId, { count, lastFailure: Date.now(), cooldownUntil: Date.now() + cooldownMs });
  }
  isHealthy(modelId: string): boolean {
    const f = this.failures.get(modelId);
    return !f || Date.now() >= f.cooldownUntil;
  }
  failureCount(modelId: string): number { return this.failures.get(modelId)?.count ?? 0; }
}

export class ModelGateway {
  private providers = new Map<string, ModelProvider>();
  constructor(readonly health = new ProviderHealthTracker()) {
    this.register(new MockProvider());
    this.register(new OpenAICompatibleProvider());
    this.register(new AnthropicProvider());
    this.register(new GoogleProvider());
  }
  register(p: ModelProvider): void { this.providers.set(p.providerName, p); }
  providerFor(spec: ModelSpec): ModelProvider {
    return this.providers.get(spec.provider) ?? this.providers.get("mock")!;
  }
  async complete(spec: ModelSpec, req: ModelRequest): Promise<ModelResponse> {
    const provider = this.providerFor(spec);
    try {
      const res = await provider.complete(spec, req);
      this.health.recordSuccess(spec.id);
      return res;
    } catch (e) {
      this.health.recordFailure(spec.id);
      throw e;
    }
  }
}
