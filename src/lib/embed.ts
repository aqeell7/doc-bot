// =====================================================================
// src/lib/embed.ts — turn text into embeddings (number lists)
// Concept file (you wrote this).
//
// Embedding = a list of numbers that is a piece of text's ADDRESS on a
// "meaning map". Similar meanings get nearby addresses.
// =====================================================================

import { client } from "./openai";

// SYNTAX: `async` = this function makes a network call and must be awaited.
// SYNTAX: `Promise<number[][]>` = it hands back an "order slip" (Promise)
//   that later turns into number[][] — a LIST of number LISTS.
//   One inner list (1536 numbers) per input text.
//
// IN:  ["dog", "puppy"]
// OUT: [[0.01, -0.3, ...], [0.02, -0.28, ...]]
export async function embedTexts(texts: string[]): Promise<number[][]> {
  // Edge case: nothing to embed → don't waste an API call.
  if (texts.length === 0) {
    return [];
  }

  // ONE API call for ALL the texts (not one call per text).
  // One network trip = faster + fewer chances to fail.
  const embedding = await client.embeddings.create({
    // An EMBEDDING model, not a chat model (gpt-5-nano can't embed).
    model: "text-embedding-3-small",
    input: texts,
    // No `dimensions` option → default 1536 numbers.
    // (dimensions: 3 squashed the meaning and gave crazy scores.)
  });

  // Cost tracking: how many tokens this call used.
  console.log("Total Tokens Used:", embedding.usage.total_tokens);

  // GOTCHA: `data` is ALWAYS an array, even for one input.
  // .map turns [{embedding: [...]}, {embedding: [...]}] into [[...], [...]].
  // The order matches the input order.
  return embedding.data.map((item) => item.embedding);
}