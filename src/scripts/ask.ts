import { pool } from "../lib/db";
import { retrieve, vectorSearch, keywordSearch, SearchMode } from "../lib/retrieve";
import { answerQuestion, RetrievedChunk } from "../lib/answer";
import { rerank } from "../lib/rerank";

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

async function ask() {
  const debug = process.argv.includes("--debug");
  const mode = (flag("mode") ?? "hybrid") as SearchMode; // vector | keyword | hybrid
  const source = flag("source");                         // e.g. nimbus-admin-guide.pdf
  const filter = source ? { source } : {};
  const useRerank = process.argv.includes("--rerank");

  // The question = the first argument that isn't a --flag.
  const question = process.argv.slice(2).find((a) => !a.startsWith("--"));
  if (!question) {
    console.log('usage: npm run ask -- "your question" [--mode=vector|keyword|hybrid] [--source=file] [--debug]');
    return;
  }

  console.log(`MODE: ${mode}${source ? `   SOURCE: ${source}` : ""}`);

  try {
    // In hybrid + debug, also show the two lists BEFORE the merge,
    // so you can see where each chunk came from.
    if (debug && mode === "hybrid") {
      printList("VECTOR LIST (before merge)", await vectorSearch(question, 10, filter));
      printList("KEYWORD LIST (before merge)", await keywordSearch(question, 10, filter));
    }

    // 1. RETRIEVE
        let chunks: RetrievedChunk[];
      if (useRerank) {
      // the screen: grab 20 candidates
      const candidates = await retrieve(question, 20, mode, filter);
      if (debug) printList("BEFORE RERANK (20 candidates)", candidates);

      // the interview: the LLM picks the best 5
      const started = Date.now();
      chunks = await rerank(question, candidates, 5);
      console.log(`rerank took ${Date.now() - started} ms`);
      if (debug) printList("AFTER RERANK (what the model sees)", chunks);
    } else {
      // no rerank: search's own top 5, same as before
      chunks = await retrieve(question, 5, mode, filter);
      if (debug) printList(mode === "hybrid" ? "MERGED (what the model sees)" : "RETRIEVED", chunks);
    }

    // 2 + 3. AUGMENT + GENERATE
    const answer = await answerQuestion(question, chunks);
    console.log("\nANSWER:\n" + answer);

    // 4. CITE
    console.log("\nSOURCES:");
    chunks.forEach((c, i) => {
      const where = c.page ? `${c.source}, page ${c.page}` : c.source;
      console.log(`[${i + 1}] ${where}, chunk ${c.position} (score ${c.similarity.toFixed(3)})`);
    });
  } finally {
    await pool.end();
  }
}

ask().catch(console.error);
