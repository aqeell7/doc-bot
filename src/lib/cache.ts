// src/lib/cache.ts — semantic cache: reuse an answer when a new question MEANS the same as an old one
import { pool } from "./db";
import { embedTexts } from "./embed";
import { pickCacheHit, type CacheCandidate } from "./cache-check";

// How close a new question must be to a saved one (0–1) to reuse its answer.
// 0.90 is a placeholder; your Step C1 probe decides the real value.
export const CACHE_THRESHOLD = 0.95;

export async function lookupCache(question: string, source: string | null) {
  const started = Date.now();
  const [embedding] = await embedTexts([question]);

  const result = await pool.query(
    `SELECT id::int AS id, question, answer, sources,
            1 - (embedding <=> $1) AS similarity
     FROM answer_cache
     WHERE source_filter IS NOT DISTINCT FROM $2
     ORDER BY embedding <=> $1
     LIMIT 3`,
    [JSON.stringify(embedding), source]
  );

  const rows = result.rows as CacheCandidate[];
  const hit = pickCacheHit(rows, CACHE_THRESHOLD);
  return {
    hit,
    embedding, // kept so a miss can be saved later without embedding again
    topScore: rows.length > 0 ? rows[0].similarity : null,
    ms: Date.now() - started,
  };
}

export async function saveToCache(
  question: string,
  source: string | null,
  embedding: number[],
  answer: string,
  sourcesJson: string
) {
  await pool.query(
    `INSERT INTO answer_cache (question, source_filter, embedding, answer, sources)
     VALUES ($1, $2, $3, $4, $5)`,
    [question, source, JSON.stringify(embedding), answer, sourcesJson]
  );
}