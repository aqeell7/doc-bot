// src/lib/meter.ts — turn an API call's `usage` into one line on the bill
import type { StageStat } from "./stage-report";

// Dollars per 1 million tokens. Update if prices change or you add a model.
const PRICES: Record<string, { input: number; output: number }> = {
  "gpt-5-nano": { input: 0.05, output: 0.4 },
  "gpt-5-mini": { input: 0.25, output: 2.0 },
  "text-embedding-3-small": { input: 0.02, output: 0 },
};

// A meter is just the list of bill lines for ONE question.
export type Meter = StageStat[];

export function costUsd(model: string, inputTokens: number, outputTokens: number): number {
  const price = PRICES[model];
  if (!price) throw new Error(`No price for model "${model}" in meter.ts`);
  return (inputTokens * price.input + outputTokens * price.output) / 1_000_000;
}

// The parts of a chat-completions `usage` object we read.
type ChatUsage =
  | {
      prompt_tokens: number;
      completion_tokens: number;
      completion_tokens_details?: { reasoning_tokens?: number } | null;
    }
  | null
  | undefined;

// After a chat call: push one line. No meter given → do nothing (the web route doesn't pass one).
export function recordChat(meter: Meter | undefined, stage: string, model: string, ms: number, usage: ChatUsage) {
  if (!meter) return;
  const inputTokens = usage?.prompt_tokens ?? 0;
  const outputTokens = usage?.completion_tokens ?? 0;
  meter.push({
    stage,
    ms,
    inputTokens,
    outputTokens,
    reasoningTokens: usage?.completion_tokens_details?.reasoning_tokens ?? 0,
    costUsd: costUsd(model, inputTokens, outputTokens),
  });
}

// After embedding calls: push one line (embeddings have input tokens only).
export function recordEmbed(meter: Meter | undefined, stage: string, ms: number, tokens: number) {
  if (!meter) return;
  meter.push({
    stage,
    ms,
    inputTokens: tokens,
    outputTokens: 0,
    reasoningTokens: 0,
    costUsd: costUsd("text-embedding-3-small", tokens, 0),
  });
}