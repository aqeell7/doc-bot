import { client } from "./openai";

// One chunk as it comes back from the database.
export type RetrievedChunk = {
    id: number;              // the row id — needed so the merge can spot the SAME chunk in two lists
    source: string;
    page: number | null;
    position: number;
    content: string;
    similarity: number;
};

// The exam rules. This is what makes "I don't know" possible.
const SYSTEM_PROMPT = `You answer questions using ONLY the numbered context passages provided.
Rules:
1. Use only facts stated in the context. Do not use outside knowledge.
2. After each fact, cite the passage number in square brackets, like [2].
3. If the context does not contain the answer, reply exactly: "I don't know based on the documents."
4. Keep answers short and plain.`;

export async function answerQuestion(question: string, chunks: RetrievedChunk[]): Promise<string> {

    const context = chunks.map((chunk, i) => `[${i + 1}] ${chunk.content}`).join("\n\n")

    const userMessage = "Content:\n" + context + "\n\nQuestion: " + question;

    const response = await client.chat.completions.create({
        model: "gpt-5-nano",
        messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userMessage }
        ]
    })

    return response.choices[0]?.message?.content ?? "";
}

// Same prompt and context as answerQuestion, but the reply arrives in PIECES.
export async function* streamAnswer(question: string, chunks: RetrievedChunk[]): AsyncGenerator<string> {
    const context = chunks.map((chunk, i) => `[${i + 1}] ${chunk.content}`).join("\n\n");
    const userMessage = "Content:\n" + context + "\n\nQuestion: " + question;

    const stream = await client.chat.completions.create({
        model: "gpt-5-nano",
        reasoning_effort: "low",   // middle ground: some thinking for the "does the context answer this?" judgement       
        messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userMessage },
        ],
        stream: true,
    });

    for await (const event of stream) {
        const piece = event.choices[0]?.delta?.content;
        if (piece) yield piece;
    }
}