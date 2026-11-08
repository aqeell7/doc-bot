import { readFileSync } from "node:fs";
import { embedTexts } from "../src/lib/embed";
import { cosineSimilarity } from "../src/lib/similarity";
import { chunkFixed, chunkWithOverlap } from "../src/lib/chunk";

const questions = [
  "Can I get a refund on a yearly Plus plan?",
  "What happens if my card payment fails?",
  "How long do deleted notes stay in the trash?",
  "Can I undo deleting my account?",
];

// Score the question against EVERY chunk, keep the highest.
// The scoring IS the matching. There is no separate "find" step.
function findBest(questionVector: number[], chunks: string[], chunkVectors: number[][]) {
  let bestIndex = 0;
  let bestScore = -1; // lower than any real score

  for (let i = 0; i < chunks.length; i++) {
    const score = cosineSimilarity(questionVector, chunkVectors[i]);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }

  return { text: chunks[bestIndex], score: bestScore };
}

async function main() {
  // --- Hand tests (free, no API) ---
  console.log(chunkFixed("abcdefghij", 4));           // ["abcd","efgh","ij"]
  console.log(chunkWithOverlap("abcdefghij", 4, 2));  // ["abcd","cdef","efgh","ghij"]
  try {
    chunkWithOverlap("abc", 4, 4);
  } catch {
    console.log("threw as expected");
  }

  // --- Read the document as ONE string ---
  const doc = readFileSync("data/docs/nimbus-handbook.md", "utf-8");

  // --- Chunk it both ways ---
  const fixedChunks = chunkFixed(doc, 500);
  const overlapChunks = chunkWithOverlap(doc, 500, 100);
  console.log("fixed chunks:", fixedChunks.length);
  console.log("overlap chunks:", overlapChunks.length);

  // --- Embed everything (3 calls) ---
  const fixedVectors = await embedTexts(fixedChunks);
  const overlapVectors = await embedTexts(overlapChunks);
  const questionVectors = await embedTexts(questions);

  // --- For each question, show the best chunk from each method ---
  for (let i = 0; i < questions.length; i++) {
    const fixedBest = findBest(questionVectors[i], fixedChunks, fixedVectors);
    const overlapBest = findBest(questionVectors[i], overlapChunks, overlapVectors);

    console.log("\n=== QUESTION:", questions[i]);
    console.log("\n--- FIXED", fixedBest.score.toFixed(2), "---\n" + fixedBest.text);
    console.log("\n--- OVERLAP", overlapBest.score.toFixed(2), "---\n" + overlapBest.text);
  }
}

main().catch(console.error);