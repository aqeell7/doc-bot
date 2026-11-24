import { addUp, type StageStat } from "../src/lib/stage-report";

const line = (stage: string, ms: number, inTok: number, outTok: number, cost: number): StageStat => ({
  stage, ms, inputTokens: inTok, outputTokens: outTok, reasoningTokens: 0, costUsd: cost,
});

// Test 1: a normal 4-stage bill
const r = addUp([
  line("rewrite", 1000, 300, 20, 0.0001),
  line("retrieve", 500, 10, 0, 0),
  line("rerank", 3500, 1500, 400, 0.0003),
  line("generate", 5000, 900, 1200, 0.0006),
]);
for (const row of r.rows) console.log(`${row.stage}  time ${row.timeShare}%  cost ${row.costShare}%`);
console.log(`total ${r.totalMs} ms  $${r.totalCostUsd.toFixed(6)}  ${r.totalTokens} tokens`);

// Test 2: empty bill
const e = addUp([]);
console.log(`empty: ${e.rows.length} rows, ${e.totalMs} ms, $${e.totalCostUsd.toFixed(6)}`);

// Test 3: everything zero (must not print NaN)
const z = addUp([line("zero", 0, 0, 0, 0)]);
console.log(`zero: time ${z.rows[0].timeShare}%  cost ${z.rows[0].costShare}%`);