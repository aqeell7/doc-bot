// =====================================================================
// src/lib/store.ts — save embeddings to pgvector, and search them
// Concept file (you wrote this).
//
// Analogy: Postgres is a filing cabinet. pgvector adds a drawer that
// holds number lists (the `vector` column) and a way to sort drawers
// by closeness (the <=> operator).
// =====================================================================

import { pool } from "./db";

// ---------------------------------------------------------------------
// insertSentence — save ONE sentence + its embedding as a new row.
// ---------------------------------------------------------------------
export async function insertSentence(content: string, embedding: number[]) {
  // SYNTAX: $1, $2 are BLANKS (placeholders) in the SQL text.
  // You never paste values into the SQL string yourself.
  const insertSentence = `INSERT INTO sentences(content, embedding) VALUES ($1, $2)`;

  // SYNTAX: pool.query(sql, values)
  //   values[0] fills $1, values[1] fills $2.
  //   The pg library fills the blanks SAFELY → no SQL injection.
  //
  // SYNTAX: JSON.stringify(embedding)
  //   The pg library doesn't understand the `vector` type.
  //   JSON.stringify turns [0.1, -0.3] into the TEXT "[0.1,-0.3]",
  //   which is exactly the format pgvector reads.
  //
  // No try/catch on purpose: if the insert fails, the error should
  // stop the seed script loudly instead of printing "inserted 50 rows".
  await pool.query(insertSentence, [content, JSON.stringify(embedding)]);
}

// ---------------------------------------------------------------------
// findTop5 — give it the question's embedding, get back the 5 closest
// sentences with a similarity score.
//
// SYNTAX: Promise<{ content: string; similarity: number }[]>
//   async → returns a Promise ("order slip")
//   ...that turns into a LIST ([]) of objects shaped { content, similarity }.
//
// GOTCHA: the property names MUST match the names in the SQL (`content`,
//   `AS similarity`). result.rows is `any`, so TypeScript just BELIEVES
//   this type — it can't check it. A wrong name (cosineSimilarity) gives
//   `undefined` at runtime, and .toFixed crashes. (Same lesson as Zod:
//   TS can't check what arrives at runtime.)
// ---------------------------------------------------------------------
export async function findTop5(
  queryEmbedding: number[]
): Promise<{ content: string; similarity: number }[]> {
  // Read the SQL piece by piece:
  //
  //   SELECT content,
  //     → give me the text column
  //
  //   1 - (embedding <=> $1) AS similarity
  //     → <=> is pgvector's COSINE DISTANCE: 0 = identical, bigger = further.
  //     → 1 - distance flips it into SIMILARITY: 1 = identical (like your JS function).
  //     → AS similarity NAMES this column; that name becomes the key on each row object.
  //
  //   FROM sentences
  //     → from the real table
  //
  //   ORDER BY embedding <=> $1
  //     → sort by DISTANCE, smallest first = closest first (ascending is the default).
  //     → GOTCHA 1: adding DESC would put the LEAST similar first.
  //     → GOTCHA 2: we sort by the raw distance, not by `similarity`,
  //       because an HNSW index (later) is only used when ORDER BY is the
  //       plain <=> operator.
  //
  //   LIMIT 5
  //     → only return 5 rows (the "top-k", here k = 5).
  //     → WITHOUT ORDER BY, LIMIT 5 would just return any random 5 rows.
  const selectQuery = `SELECT content, 1 - (embedding <=> $1) AS similarity FROM sentences ORDER BY embedding <=> $1 LIMIT 5`;

  // $1 is used twice in the SQL, but filled from ONE value: values[0].
  // Placeholders work for SELECT too, not just INSERT.
  const result = await pool.query(selectQuery, [JSON.stringify(queryEmbedding)]);

  // GOTCHA: the data is in result.rows, not in result itself.
  return result.rows;
}

// Save ONE chunk. source + position are kept so the bot can cite
// "nimbus-handbook.md, chunk 3" later.
export async function insertChunk(source: string, position: number, content: string, embedding: number[]) {
  await pool.query(
    `INSERT INTO chunks (source, position, content, embedding) VALUES ($1, $2, $3, $4)`,
    [source, position, content, JSON.stringify(embedding)]
  );
}