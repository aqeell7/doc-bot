import { client } from "./openai";

const REWRITE_PROMPT = `You turn a user's question into search queries for a document search engine.
The documents are an English help handbook for a note-taking app called Nimbus Notes.
Return JSON only, in this shape: {"queries": ["...", "..."]}
Rules:
- Write every query in plain English, even if the question is in another language.
- Fix spelling mistakes.
- If the question is vague, make it specific (e.g. "Is it free?" -> "Is there a free plan?").
- If the question asks about several things, write one query per thing (at most 3).
- If the question is already clear and asks one thing, return it as the only query.
- Do not answer the question.
- If the question is broad (like "what are all...", "what can't I...", "tell me everything about..."), write up to 3 queries that each cover a different aspect of the topic.`;

// gpt-5-nano prices, dollars per 1 million tokens
const INPUT_PRICE = 0.05;
const OUTPUT_PRICE = 0.4;

// Read {"queries": [...]} from the model's text.
// Anything broken or empty → fall back to the user's original question.
function readQueries(text: string, original: string): string[] {
  try {
    const data = JSON.parse(text);
    const queries = Array.isArray(data.queries)
      ? data.queries.filter((q: unknown) => typeof q === "string" && q.trim() !== "")
      : [];
    return queries.length > 0 ? queries.slice(0, 3) : [original];
  } catch {
    return [original];
  }
}

export async function rewriteQuestion(question: string) {
  const started = Date.now();

  const response = await client.chat.completions.create({
    model: "gpt-5-nano",
    response_format: { type: "json_object" },
    reasoning_effort: "minimal",   // simple job → don't let the model "think" for seconds    
    messages: [
      { role: "system", content: REWRITE_PROMPT },
      { role: "user", content: question },
    ],
  });

  const ms = Date.now() - started;
  const inputTokens = response.usage?.prompt_tokens ?? 0;
  const outputTokens = response.usage?.completion_tokens ?? 0;
  const costUsd = (inputTokens * INPUT_PRICE + outputTokens * OUTPUT_PRICE) / 1_000_000;

  const text = response.choices[0]?.message?.content ?? "";
  return { queries: readQueries(text, question), ms, inputTokens, outputTokens, costUsd };
}