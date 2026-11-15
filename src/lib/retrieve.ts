// =====================================================================
// src/lib/retrieve.ts — find the chunks that answer a question
// Real bot file. Glue (given) + calls YOUR mergeResults in merge.ts.
//
// Three ways to search:
//   vector  = "find chunks that MEAN the same"   (embeddings + <=>)
//   keyword = "find chunks that USE the same words" (Postgres full-text)
//   hybrid  = run both, then merge the two ranked lists (merge.ts)
// =====================================================================

import { pool } from "./db";
import { embedTexts } from "./embed";
import { RetrievedChunk } from "./answer";
import { mergeResults } from "./merge";

export type SearchMode = "vector" | "keyword" | "hybrid";

// Metadata filter: limit the search to one document.
// Empty object = search everything.
export type SearchFilter = { source?: string };

// ---------------------------------------------------------------------
// vectorSearch — the search you already had, plus `id` and the filter.
// ---------------------------------------------------------------------
export async function vectorSearch(
  question: string,
  k: number,
  filter: SearchFilter = {}
): Promise<RetrievedChunk[]> {
  const [queryEmbedding] = await embedTexts([question]);

  // id::int  → bigserial ids come back from pg as STRINGS ("12");
  //            ::int makes them real numbers so Map keys match.
  // ($3::text IS NULL OR source = $3)
  //          → "if no source was given, keep every row;
  //             otherwise keep only rows from that source".
  //            ::text tells Postgres what type $3 is when it's null.
  const result = await pool.query(
    `SELECT id::int AS id, source, page, position, content,
            1 - (embedding <=> $1) AS similarity
     FROM chunks
     WHERE ($3::text IS NULL OR source = $3)
     ORDER BY embedding <=> $1
     LIMIT $2`,
    [JSON.stringify(queryEmbedding), k, filter.source ?? null]
  );
  return result.rows;
}

// ---------------------------------------------------------------------
// toKeywordQuery — turn a question into a Postgres "any of these words" query.
//   "What can't I do on the Free plan?" → "what | can | t | i | do | on | the | free | plan"
//   |  means OR. Postgres then drops tiny words ("the", "on") by itself.
// Why OR and not AND: with AND, a chunk must contain EVERY word of the
// question, so most natural questions match nothing.
// Only a-z and 0-9 are kept, so odd characters can't break the query.
// ---------------------------------------------------------------------
export function toKeywordQuery(question: string): string {
  const words = question.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  return words.join(" | ");
}

// ---------------------------------------------------------------------
// keywordSearch — rank chunks by how well their WORDS match the question.
// ---------------------------------------------------------------------
export async function keywordSearch(
  question: string,
  k: number,
  filter: SearchFilter = {}
): Promise<RetrievedChunk[]> {
  const tsQuery = toKeywordQuery(question);
  if (!tsQuery) return []; // e.g. a Hindi question: no a-z words at all

  // to_tsquery('english', $1) → trims query words to roots, same as the column
  // content_tsv @@ query      → "does this chunk contain ANY of the words?"
  // ts_rank(...)              → a score: more matching words, rarer words = higher.
  //                             Stored as `similarity` so it fits RetrievedChunk,
  //                             but it is NOT on the 0–1 cosine scale.
  // ORDER BY ... DESC         → here BIGGER is better (unlike <=> distance).
  const result = await pool.query(
    `SELECT id::int AS id, source, page, position, content,
            ts_rank(content_tsv, query) AS similarity
     FROM chunks, to_tsquery('english', $1) AS query
     WHERE content_tsv @@ query
       AND ($3::text IS NULL OR source = $3)
     ORDER BY similarity DESC
     LIMIT $2`,
    [tsQuery, k, filter.source ?? null]
  );
  return result.rows;
}

// ---------------------------------------------------------------------
// retrieve — the one function the rest of the bot calls.
// ---------------------------------------------------------------------
export async function retrieve(
  question: string,
  k: number = 5,
  mode: SearchMode = "hybrid",
  filter: SearchFilter = {}
): Promise<RetrievedChunk[]> {
  if (mode === "vector") return vectorSearch(question, k, filter);
  if (mode === "keyword") return keywordSearch(question, k, filter);

  // hybrid: ask each search for MORE candidates than we need (k * 2),
  // so a chunk ranked 7th by one search still gets a chance to rise.
  // Promise.all = run both searches at the same time, wait for both.
  const candidates = k * 2;
  const [vectorList, keywordList] = await Promise.all([
    vectorSearch(question, candidates, filter),
    keywordSearch(question, candidates, filter),
  ]);
  return mergeResults(vectorList, keywordList, k);
}
