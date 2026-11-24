import { pool } from "../lib/db";
import { retrieve, vectorSearch, keywordSearch, SearchMode, SearchFilter } from "../lib/retrieve";
import { answerQuestion, RetrievedChunk } from "../lib/answer";
import { rerank } from "../lib/rerank";
import { rewriteQuestion } from "../lib/rewrite";
import { takeTurns } from "../lib/merge";
import { usage } from "../lib/embed";
import { recordEmbed, type Meter } from "../lib/meter";
import { addUp, type StageReport } from "../lib/stage-report";

// Read a flag like --mode=hybrid → "hybrid". Missing → undefined.
function flag(name: string): string | undefined {
  const arg = process.argv.find((a) => a.startsWith(`--${name}=`));
  return arg ? arg.split("=")[1] : undefined;
}

// Print one ranked list in a compact way: [rank] source#chunk (score) text...
function printList(title: string, list: RetrievedChunk[]) {
  console.log(`\n${title}:`);
  if (list.length === 0) console.log("  (nothing)");
  list.forEach((c, i) => {
    console.log(
      `[${i + 1}] ${c.source}#${c.position} (${c.similarity.toFixed(3)}) ${c.content.slice(0, 100).replace(/\s+/g, " ")}...`
    );
  });
}

// Search every query, then let the lists take turns.
async function search(queries: string[], k: number, mode: SearchMode, filter: SearchFilter) {
  const lists = await Promise.all(queries.map((q) => retrieve(q, k, mode, filter)));
  return takeTurns(lists, k);
}

// Print one question's bill, stage by stage.
function printReport(report: StageReport) {
  console.log("\nSTAGES:");
  for (const r of report.rows) {
    console.log(
      `${r.stage.padEnd(9)} ${String(r.ms).padStart(6)} ms ${String(r.timeShare).padStart(3)}%  | ` +
        `in ${String(r.inputTokens).padStart(5)}  out ${String(r.outputTokens).padStart(5)} (thinking ${r.reasoningTokens})  | ` +
        `$${r.costUsd.toFixed(6)} ${String(r.costShare).padStart(3)}%`
    );
  }
  console.log(`TOTAL     ${report.totalMs} ms  |  ${report.totalTokens} tokens  |  $${report.totalCostUsd.toFixed(6)}`);
}

type Options = {
  debug: boolean;
  mode: SearchMode;
  filter: SearchFilter;
  useRerank: boolean;
  useRewrite: boolean;
};

// The whole pipeline for ONE question, with its own fresh bill.
async function askOne(question: string, o: Options): Promise<StageReport> {
  const meter: Meter = [];
  console.log(`\n=== QUESTION: ${question}`);

  if (o.debug && o.mode === "hybrid") {
    printList("VECTOR LIST (before merge)", await vectorSearch(question, 10, o.filter));
    printList("KEYWORD LIST (before merge)", await keywordSearch(question, 10, o.filter));
  }

  // 0. REWRITE (optional)
  let searchQueries = [question];
  if (o.useRewrite) {
    const rw = await rewriteQuestion(question, meter);
    searchQueries = rw.queries;
    console.log("REWRITTEN:", searchQueries);
  }

  // 1. RETRIEVE: 20 candidates if we will rerank, else the final 5
  const k = o.useRerank ? 20 : 5;
  const tokensBefore = usage.tokens;
  const searchStarted = Date.now();
  const found = await search(searchQueries, k, o.mode, o.filter);
  recordEmbed(meter, "retrieve", Date.now() - searchStarted, usage.tokens - tokensBefore);

  // 2. RERANK (optional)
  let chunks: RetrievedChunk[];
  if (o.useRerank) {
    if (o.debug) printList("BEFORE RERANK (20 candidates)", found);
    chunks = await rerank(question, found, 5, meter);
    if (o.debug) printList("AFTER RERANK (what the model sees)", chunks);
  } else {
    chunks = found;
    if (o.debug) printList(o.mode === "hybrid" ? "MERGED (what the model sees)" : "RETRIEVED", chunks);
  }

  // 3. GENERATE
  const answer = await answerQuestion(question, chunks, meter);
  console.log("\nANSWER:\n" + answer);

  // 4. CITE
  console.log("\nSOURCES:");
  chunks.forEach((c, i) => {
    const where = c.page ? `${c.source}, page ${c.page}` : c.source;
    console.log(`[${i + 1}] ${where}, chunk ${c.position} (score ${c.similarity.toFixed(3)})`);
  });

  // 5. THE BILL
  const report = addUp(meter);
  printReport(report);
  return report;
}

async function main() {
  const source = flag("source");
  const o: Options = {
    debug: process.argv.includes("--debug"),
    mode: (flag("mode") ?? "hybrid") as SearchMode,
    filter: source ? { source } : {},
    useRerank: process.argv.includes("--rerank"),
    useRewrite: process.argv.includes("--rewrite"),
  };

  // Every argument that isn't a --flag is a question. One or many.
  const questions = process.argv.slice(2).filter((a) => !a.startsWith("--"));

  try {
    if (questions.length === 0) {
      console.log('usage: npm run ask -- "question 1" ["question 2" ...] [--mode=...] [--source=file] [--rewrite] [--rerank] [--debug]');
      return;
    }
    console.log(`MODE: ${o.mode}${source ? `  SOURCE: ${source}` : ""}  REWRITE: ${o.useRewrite}  RERANK: ${o.useRerank}`);

    const reports: StageReport[] = [];
    for (const q of questions) reports.push(await askOne(q, o));

    if (reports.length > 1) {
      const allCost = reports.reduce((sum, r) => sum + r.totalCostUsd, 0);
      const allMs = reports.reduce((sum, r) => sum + r.totalMs, 0);
      const avgCost = allCost / reports.length;
      console.log(
        `\nAVERAGE over ${reports.length} questions: $${avgCost.toFixed(6)} and ${Math.round(allMs / reports.length)} ms per question`
      );
      console.log(`→ about $${(avgCost * 1000).toFixed(3)} per 1,000 questions`);
    }
  } finally {
    await pool.end();
  }
}

main().catch(console.error);