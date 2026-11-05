// =====================================================================
// src/scripts/seed-sentences.ts — WRITES: fill the database once
// Run:  npm run seed
//
// Embeds all 50 sentences ONE time and stores them. After this,
// search.ts never re-embeds them — that's the whole point of storing.
// =====================================================================

import { pool } from "../lib/db";
import { embedTexts } from "../lib/embed";
import { insertSentence } from "../lib/store";
import { sentences } from "../data/sentences";

async function seed() {
  // TRUNCATE = empty the table (delete every row, keep the table).
  // Stops duplicates if you run the seed twice.
  // (S4 replaces this with proper "don't insert twice" logic.)
  await pool.query("TRUNCATE sentences");

  // ONE API call for all 50 sentences. `await` ONCE, here, so
  // `vectors` is the real number[][] — not a Promise.
  const vectors = await embedTexts(sentences);

  // sentences[i] and vectors[i] line up: same position = same sentence.
  for (let i = 0; i < vectors.length; i++) {
    // GOTCHA: `await` inside the loop. Without it, all 50 inserts fire
    // off at once, the loop finishes immediately, pool.end() runs while
    // inserts are still going → "Cannot use a pool after calling end".
    // RULE: if a function is async, every call to it needs `await`.
    await insertSentence(sentences[i], vectors[i]);
  }

  console.log("inserted 50 rows");

  // Close the connections so the script can finish (otherwise it hangs).
  await pool.end();
}

// A function that's defined but never CALLED does nothing.
// .catch(console.error) prints any error instead of an ugly crash.
seed().catch(console.error);