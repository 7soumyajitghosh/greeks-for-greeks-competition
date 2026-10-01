import type { ModelRequest, ModelResponse, ModelSpec } from "../core/types";
import type { ModelGateway } from "./ModelGateway";

export interface FallbackOutcome {
  response: ModelResponse;
  modelUsed: ModelSpec;
  fallbacks: number;
  errors: string[];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class FallbackHandler {
  constructor(private gateway: ModelGateway, private maxRetries = 2) {}

  async execute(chain: ModelSpec[], req: ModelRequest, onFallback?: (from: string, to: string, error: string) => void): Promise<FallbackOutcome> {
    const errors: string[] = [];
    let fallbacks = 0;
    let prevId = "";
    for (const spec of chain) {
      for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
        try {
          const response = await this.gateway.complete(spec, req);
          return { response, modelUsed: spec, fallbacks, errors };
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          const retryable = /429|5\d\d|timeout|rate|quota|network|fetch/i.test(msg);
          errors.push(`${spec.id} attempt ${attempt + 1}: ${msg}`);
          if (attempt < this.maxRetries && retryable) {
            await sleep(500 * 2 ** attempt + Math.random() * 200); // exponential backoff + jitter
            continue;
          }
          break;
        }
      }
      if (prevId) onFallback?.(prevId, spec.id, errors[errors.length - 1] ?? "failed");
      else if (errors.length) onFallback?.(spec.id, chain[chain.indexOf(spec) + 1]?.id ?? "none", errors[errors.length - 1]);
      prevId = spec.id;
      fallbacks += 1;
    }
    throw new Error(`All models failed: ${errors.join(" | ").slice(0, 1000)}`);
  }
}
