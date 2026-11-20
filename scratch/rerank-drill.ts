import { pickChunks } from "../src/lib/rerank";
import { RetrievedChunk } from "../src/lib/answer";

const fake = (id: number, label: string): RetrievedChunk =>
  ({ id, source: "fake.md", page: null, position: id, content: label, similarity: 0 });
const chunks = [fake(1, "A"), fake(2, "B"), fake(3, "C")];
const show = (title: string, list: RetrievedChunk[]) =>
  console.log(title, list.map((c) => c.content).join(", ") || "(empty)");

show("Test 1 messy output, k=2:", pickChunks([3, 3, 9, 0, 2.5, 1, 2], chunks, 2));
show("Test 2 model gave nothing:", pickChunks([], chunks, 2));
show("Test 3 fewer than k is fine:", pickChunks([2, 1], chunks, 5));