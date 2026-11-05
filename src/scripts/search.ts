// =====================================================================
// src/scripts/search.ts — READS: ask a question, get the 5 closest
// Run:  npm run search -- "how do I get my money back"
//
// Only the QUESTION is embedded here. The 50 sentences were embedded
// once by seed-sentences.ts and live in the database.
// =====================================================================

import { pool } from "../lib/db";
import { embedTexts } from "../lib/embed";
import { findTop5 } from "../lib/store";

async function search() {
  // SYNTAX: process.argv = the words typed on the command line.
  //   argv[0] = node, argv[1] = this file, argv[2] = YOUR question.
  // SYNTAX: `npm run search -- "..."` — the `--` tells npm
  //   "pass everything after this to the script, not to npm".
  const question = process.argv[2];

  // Edge case: no question typed → explain how to use it, then stop.
  if (!question) {
    console.log('usage: npm run search -- "your question"');
    return;
  }

  // SYNTAX: try { ... } finally { ... }
  //   finally ALWAYS runs — on success AND on error.
  //   So the pool is always closed and the script never hangs.
  try {
    // embedTexts takes a LIST and returns a LIST.
    //   [question]  → wrap the one string in a list (IN)
    //   (...)[0]    → take the first (only) vector out (OUT)
    // The brackets around `await embedTexts(...)` make the await finish
    // FIRST, then [0] is taken from the real result.
    const queryVector = (await embedTexts([question]))[0];

    // The database finds the 5 closest sentences.
    const rows = await findTop5(queryVector);

    // SYNTAX: for...of walks through each item of the list directly.
    // row.similarity — the key name comes from `AS similarity` in the SQL.
    // .toFixed(2) → 0.354213 becomes "0.35".
    // Reading the scores: SIMILARITY, so closer to 1 = closer meaning.
    // Trust the top of the list; low scores (~0–0.15) are noise.
    for (const row of rows) {
      console.log(row.similarity.toFixed(2), " ", row.content);
    }
  } finally {
    await pool.end();
  }
}

search().catch(console.error);