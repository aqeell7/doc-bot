// =====================================================================
// src/lib/merge.ts — merge two ranked lists into one (Reciprocal Rank Fusion)
// Real bot file. CONCEPT CODE: you write the // YOU: lines.
//
// Idea: each list hands out points by POSITION.
//   1st place = 1/(60+1), 2nd = 1/(60+2), 3rd = 1/(60+3) ...
// A chunk that appears in BOTH lists collects points twice → rises to the top.
// We never compare the raw scores (cosine 0.72 vs ts_rank 0.06) — different scales.
// =====================================================================

import { RetrievedChunk } from "./answer";

// The standard "softener". It keeps 1st and 2nd place close in points,
// so one list can't bully the other. Don't tune it.
const RRF_K = 60;

export function mergeResults(
  vectorList: RetrievedChunk[],
  keywordList: RetrievedChunk[],
  k: number
): RetrievedChunk[] {
  const points = new Map<number, number>();            // chunk id → total points so far
  const chunkById = new Map<number, RetrievedChunk>(); // chunk id → the chunk itself

  for (const list of [vectorList, keywordList]) {
    list.forEach((chunk, index) => {
      const rank = index + 1; // index 0 = 1st place

      // YOU (1): work out the points this list gives this chunk: 1 / (RRF_K + rank)
      const score = 1/(RRF_K + rank)

      // YOU (2): add them to the chunk's running total in `points`
      //          (a chunk seen for the first time starts from 0)
      const currentTotal = points.get(chunk.id) ?? 0;
      points.set(chunk.id, currentTotal + score);

      // YOU (3): store the chunk in `chunkById` under its id
      chunkById.set(chunk.id, chunk);
    });
  }

  // YOU (4): turn `points` into a list of [id, total] pairs,
  //          sorted by total, biggest first
  const sortedEntries = Array.from(points.entries()).sort((a, b) => b[1] - a[1]);

  // YOU (5): keep only the first k pairs, and turn each pair back into
  //          its chunk, with `similarity` replaced by the total points
  const topChunks = sortedEntries.slice(0, k).map(([id, totalScore]) => {
    const chunk = chunkById.get(id)!;
    return {
      ...chunk,
      similarity: totalScore, // swap the old score with the RRF total points
    };
  });

  return topChunks; // ← YOU: replace with your result from (5)
}


// Combine several ranked lists by TAKING TURNS (playground team-picking).
// Used after query rewriting: each list belongs to a different part of the
// question, so every part must get seats in the final pile.
// (Different from mergeResults, which rewards chunks found by BOTH lists.)
export function takeTurns(lists: RetrievedChunk[][], total: number): RetrievedChunk[] {
  const result: RetrievedChunk[] = [];
  const usedIds = new Set<number>();

  // round 0 = everyone's 1st choice, round 1 = everyone's 2nd choice, ...
  for (let round = 0; result.length < total; round++) {
    let anyListHadOne = false;

    for (const list of lists) {
      // (1) This list doesn't have an item at index `round`
      if (round >= list.length) {
        continue;
      }

      // (2) This list has a chunk at `round` — mark round as active and grab it
      anyListHadOne = true;
      const chunk = list[round];

      // (3) Skip if we already added a chunk with this same id
      if (usedIds.has(chunk.id)) {
        continue;
      }

      // (4) Keep this chunk, remember its id, and stop if we hit `total`
      result.push(chunk);
      usedIds.add(chunk.id);

      if (result.length >= total) {
        break;
      }
    }

    // (5) If no list had a chunk at `round`, all lists are exhausted — stop outer loop
    if (!anyListHadOne) {
      break;
    }
  }

  return result;
}

/*

npx tsx scratch/merge-drill.ts
npm run ask -- "How long do invite links last?" --source=nimbus-admin-guide.pdf
npm run ask -- "What can't I do on the Free plan?" --mode=vector --debug && npm run ask -- "What can't I do on the Free plan?" --mode=hybrid --debug
npm run ask -- "Tell me everything about billing" --mode=vector --debug && npm run ask -- "Tell me everything about billing" --mode=hybrid --debug
npm run ask -- "Does Nimbus work with Entra?" --mode=keyword --debug && npm run ask -- "क्या मुझे रिफंड मिल सकता है?" --mode=hybrid --debug

*/