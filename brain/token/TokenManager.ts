import { estimateTokens } from "../context/tokenizer";

export class TokenManager {
  private inputUsed = 0;
  private outputUsed = 0;
  private costUsd = 0;
  constructor(private tokenBudget: number, private costBudgetUsd: number) {}

  get usage(): { input: number; output: number; costUsd: number } {
    return { input: this.inputUsed, output: this.outputUsed, costUsd: this.costUsd };
  }

  estimate(text: string): number { return estimateTokens(text); }

  canAfford(inputTokens: number, outputTokens: number, costUsd: number): boolean {
    return (
      this.inputUsed + this.outputUsed + inputTokens + outputTokens <= this.tokenBudget &&
      this.costUsd + costUsd <= this.costBudgetUsd
    );
  }

  // Rough pre-call cost using model pricing
  estimateCost(inputTokens: number, outputTokens: number, costPer1kInput: number, costPer1kOutput: number): number {
    return (inputTokens / 1000) * costPer1kInput + (outputTokens / 1000) * costPer1kOutput;
  }

  record(inputTokens: number, outputTokens: number, costUsd: number): void {
    this.inputUsed += inputTokens;
    this.outputUsed += outputTokens;
    this.costUsd += costUsd;
  }

  remainingTokens(): number { return Math.max(0, this.tokenBudget - this.inputUsed - this.outputUsed); }
  remainingBudgetUsd(): number { return Math.max(0, this.costBudgetUsd - this.costUsd); }
}
