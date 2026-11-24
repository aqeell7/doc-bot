import { client } from "./openai";
import { RetrievedChunk } from "./answer";
import { recordChat, type Meter } from "./meter";

export function pickChunks(
  picked: number[],
  chunks: RetrievedChunk[],
  k: number
): RetrievedChunk[] {
  const result: RetrievedChunk[] = [];
  const used = new Set<number>();

  for (const n of picked) {
    if (result.length >= k) {
      break;
    }

    if (!Number.isInteger(n) || n < 1 || n > chunks.length) {
      continue;
    }

    if (used.has(n)) {
      continue;
    }

    result.push(chunks[n - 1]);
    used.add(n);
  }

  if (result.length === 0) {
    return chunks.slice(0, k);
  }

  return result;
}

const RERANK_PROMPT = `You rank passages by how useful they are for answering a question.
You get a question and numbered passages.
Return JSON only, in this shape: {"ranking": [3, 1, 7]}
- List the numbers of the passages that help answer the question, most useful first.
- List at most {K} numbers.
- If no passage helps, return {"ranking": []}.`;

// Read {"ranking": [...]} out of the model's text. Broken JSON → empty list.
function readRanking(text: string): number[] {
  try {
    const data = JSON.parse(text);
    return Array.isArray(data.ranking) ? data.ranking : [];
  } catch {
    return [];
  }
}

// The interview: question + candidates in → best k chunks out.
export async function rerank(
  question: string,
  chunks: RetrievedChunk[],
    k: number,
  meter?: Meter
): Promise<RetrievedChunk[]> {
  if (chunks.length === 0) return [];

  const passages = chunks.map((c, i) => `[${i + 1}] ${c.content}`).join("\n\n");

  const started = Date.now();  
  const response = await client.chat.completions.create({
    model: "gpt-5-nano",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: RERANK_PROMPT.replace("{K}", String(k)) },
      { role: "user", content: `Question: ${question}\n\nPassages:\n${passages}` },
    ],
  });

  recordChat(meter, "rerank", "gpt-5-nano", Date.now() - started, response.usage);
  const text = response.choices[0]?.message?.content ?? "";
  return pickChunks(readRanking(text), chunks, k);
}