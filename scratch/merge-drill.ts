// =====================================================================
// scratch/merge-drill.ts — hand test for mergeResults. PRACTICE file.
// No database, no API: fake chunks only.
// Run: npx tsx scratch/merge-drill.ts
// =====================================================================

import { mergeResults } from "../src/lib/merge";
import { RetrievedChunk } from "../src/lib/answer";

// Helper: make a fake chunk with just an id and a label.
function fake(id: number, label: string): RetrievedChunk {
  return { id, source: "fake.md", page: null, position: id, content: label, similarity: 0 };
}

const A = fake(1, "A");
const B = fake(2, "B");
const C = fake(3, "C");
const D = fake(4, "D");

function show(title: string, list: RetrievedChunk[]) {
  console.log(`\n${title}`);
  list.forEach((c) => console.log(`  ${c.content}  ${c.similarity.toFixed(4)}`));
}

// Test 1: vector says A, B, C. keyword says B, D.
show("Test 1 (k=4)", mergeResults([A, B, C], [B, D], 4));

// Test 2: same lists, keep only 2.
show("Test 2 (k=2)", mergeResults([A, B, C], [B, D], 2));

// Test 3: keyword found nothing (like the Hindi question).
show("Test 3 (empty keyword list, k=3)", mergeResults([A, B, C], [], 3));
