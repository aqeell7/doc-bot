import { takeTurns } from "../src/lib/merge";
import { RetrievedChunk } from "../src/lib/answer";

const fake = (id: number, label: string): RetrievedChunk =>
  ({ id, source: "fake.md", page: null, position: id, content: label, similarity: 0 });
const [A, B, C, D, E, F] = [1, 2, 3, 4, 5, 6].map((n, i) => fake(n, "ABCDEF"[i]));
const show = (title: string, list: RetrievedChunk[]) =>
  console.log(title, list.map((c) => c.content).join(", ") || "(empty)");

show("Test 1 three lists, total 5:", takeTurns([[A, B, C], [D, A, E], [F]], 5));
show("Test 2 lists run out first, total 10:", takeTurns([[A, B, C], [D, A, E], [F]], 10));
show("Test 3 all lists empty:", takeTurns([[], []], 3));
show("Test 4 one list (no rewrite):", takeTurns([[A, B, C]], 2));