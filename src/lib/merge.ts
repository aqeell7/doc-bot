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


/*

npx tsx scratch/merge-drill.ts
npm run ask -- "How long do invite links last?" --source=nimbus-admin-guide.pdf
npm run ask -- "What can't I do on the Free plan?" --mode=vector --debug && npm run ask -- "What can't I do on the Free plan?" --mode=hybrid --debug
npm run ask -- "Tell me everything about billing" --mode=vector --debug && npm run ask -- "Tell me everything about billing" --mode=hybrid --debug
npm run ask -- "Does Nimbus work with Entra?" --mode=keyword --debug && npm run ask -- "क्या मुझे रिफंड मिल सकता है?" --mode=hybrid --debug

*/