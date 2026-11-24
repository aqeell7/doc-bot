// How close do paraphrases score, compared with "almost the same but different" questions?
import { embedTexts } from "../src/lib/embed";
import { cosineSimilarity } from "../src/lib/similarity";

type Pair = { kind: "SAME" | "DIFFERENT" | "UNRELATED"; a: string; b: string };

const pairs: Pair[] = [
  // SAME meaning → should be a HIT
  { kind: "SAME", a: "How do I get a refund?", b: "Can I get my money back?" },
  { kind: "SAME", a: "How long do I have to ask for a refund?", b: "What is the refund window?" },
  { kind: "SAME", a: "Does Nimbus support SSO?", b: "Can we log in with single sign-on?" },
  { kind: "SAME", a: "How do I turn on dark mode?", b: "how to enable the dark theme" },
  { kind: "SAME", a: "How do I get a refund?", b: "how do i get a refnd" },
  { kind: "SAME", a: "How do I get a refund?", b: "मुझे रिफंड कैसे मिलेगा?" },
  // Almost the same words, DIFFERENT answer → must be a MISS
  { kind: "DIFFERENT", a: "Can I get a refund on the monthly Plus plan?", b: "Can I get a refund on the yearly Plus plan?" },
  { kind: "DIFFERENT", a: "What is the file size limit on the Free plan?", b: "What is the file size limit on the Plus plan?" },
  { kind: "DIFFERENT", a: "How do I add a member to my team?", b: "How do I remove a member from my team?" },
  { kind: "DIFFERENT", a: "Is there a free plan?", b: "Is there a free trial?" },
  // Nothing in common → obvious MISS
  { kind: "UNRELATED", a: "How do I get a refund?", b: "What is the capital of France?" },
];

async function main() {
  const texts = pairs.flatMap((p) => [p.a, p.b]);
  const vectors = await embedTexts(texts); // ONE API call for all 22 texts

  const rows = pairs.map((p, i) => ({
    kind: p.kind,
    score: cosineSimilarity(vectors[i * 2], vectors[i * 2 + 1]),
    pair: `${p.a}  <->  ${p.b}`,
  }));

  rows.sort((x, y) => y.score - x.score); // highest first
  for (const r of rows) console.log(`${r.score.toFixed(3)}  ${r.kind.padEnd(9)}  ${r.pair}`);
}

main().catch(console.error);