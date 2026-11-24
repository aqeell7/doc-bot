// One line on the "bill" per stage, plus a function that adds the bill up. No imports.

export type StageStat = {
  stage: string;           // "rewrite" | "retrieve" | "rerank" | "generate"
  ms: number;              // how long it took
  inputTokens: number;
  outputTokens: number;    // INCLUDES the hidden thinking tokens
  reasoningTokens: number; // the hidden thinking part of outputTokens
  costUsd: number;
};

export type StageRow = StageStat & { timeShare: number; costShare: number }; // shares are whole-number %

export type StageReport = {
  rows: StageRow[];
  totalMs: number;
  totalCostUsd: number;
  totalTokens: number;
};

export function addUp(stages: StageStat[]): StageReport {
  // Make three running totals that start at 0: totalMs, totalCostUsd, totalTokens.
  let totalMs = 0;
  let totalCostUsd = 0;
  let totalTokens = 0;

  // Loop over the stages; add each stage's ms, costUsd, and (inputTokens + outputTokens) to the totals.
  for (const s of stages) {
    totalMs += s.ms;
    totalCostUsd += s.costUsd;
    totalTokens += s.inputTokens + s.outputTokens;
  }

  // Build `rows`: for each stage, copy all its fields and add
  // timeShare = its ms as a whole-number percent of totalMs,
  // costShare = its costUsd as a whole-number percent of totalCostUsd.
  // If a total is 0, that share must be 0 (dividing by 0 gives NaN, which would print "NaN%").
  const rows: StageRow[] = stages.map((s) => ({
    ...s,
    timeShare: totalMs === 0 ? 0 : Math.round((s.ms / totalMs) * 100),
    costShare: totalCostUsd === 0 ? 0 : Math.round((s.costUsd / totalCostUsd) * 100),
  }));

  // Return { rows, totalMs, totalCostUsd, totalTokens }.
  return { rows, totalMs, totalCostUsd, totalTokens };
}