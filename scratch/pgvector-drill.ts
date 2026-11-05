// =====================================================================
// scratch/pgvector-drill.ts — practice: see how <=> and sorting behave
// Run:  npx tsx --env-file=.env scratch/pgvector-drill.ts
// No API calls, costs nothing. Tiny 3-number vectors typed by hand.
//
// Result you got:
//   east         0
//   almost east  0.0061
//   up           1
// =====================================================================

import { pool } from "../src/lib/db";

async function main() {
  try {
    // Empty the practice table so every run starts clean.
    await pool.query("TRUNCATE drill_vectors");

    // $1 = label, $2 = vector. Written once, reused 3 times.
    const insertQuery = `INSERT INTO drill_vectors (label, embedding) VALUES ($1, $2)`;

    // Vectors typed as TEXT here ("[1,0,0]"), which pgvector reads directly.
    // In store.ts they come from OpenAI as real arrays → JSON.stringify needed.
    await pool.query(insertQuery, ["east", "[1,0,0]"]);
    await pool.query(insertQuery, ["almost east", "[0.9,0.1,0]"]);
    await pool.query(insertQuery, ["up", "[0,0,1]"]);

    // The "question": pointing east.
    const targetVector = "[1,0,0]";

    // <=> = cosine DISTANCE (0 = same direction, 1 = unrelated).
    // AS distance = name that column "distance".
    // ORDER BY distance ASC = smallest first = closest first.
    // Try DESC once: "up" jumps to the top — the #1 pgvector bug.
    const selectQuery = `SELECT label, embedding <=> $1 AS distance FROM drill_vectors ORDER BY distance ASC`;

    const result = await pool.query(selectQuery, [targetVector]);

    // console.table prints the rows as a neat table.
    console.table(result.rows);
  } catch (error) {
    console.error("Error running drill:", error);
  } finally {
    // Always close the pool, success or error → script never hangs.
    await pool.end();
  }
}

main();