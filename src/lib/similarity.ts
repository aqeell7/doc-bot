// =====================================================================
// src/lib/similarity.ts — cosine similarity, written by hand
// Concept file (you wrote this).
//
// Cosine similarity = "do these two arrows point the same way?"
//   1   → same direction (same meaning)
//   0   → unrelated
//   It ignores LENGTH: [1,2] vs [2,4] = 1 (same direction, one is longer).
//
// NOTE: in the bot, the DATABASE now does this maths with <=> (see store.ts).
// This file stays as proof you understand what the database is doing.
// =====================================================================

// No `async` here: pure maths on two arrays, no network call.
export function cosineSimilarity(a: number[], b: number[]): number {
  // Guard 1: different lengths or empty → throw.
  // Without this, a[i] past the end is `undefined` → result silently NaN.
  if (a.length !== b.length || a.length === 0 || b.length === 0) {
    throw new Error("Arrays must be of the same length and cannot be empty");
  }

  // Three running totals, all start at 0.
  let dot = 0;  // how much the two arrows agree
  let sumA = 0; // used to get the length of arrow A
  let sumB = 0; // used to get the length of arrow B

  // Walk through every position once.
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    sumA += a[i] * a[i];
    sumB += b[i] * b[i];
  }

  // Length of each arrow.
  const lenA = Math.sqrt(sumA);
  const lenB = Math.sqrt(sumB);

  // Guard 2: an all-zero list has length 0 → dividing by 0 gives NaN.
  if (lenA === 0 || lenB === 0) {
    throw new Error("Vector magnitude cannot be zero.");
  }

  // Agreement divided by both lengths → a score from -1 to 1.
  return dot / (lenA * lenB);
}