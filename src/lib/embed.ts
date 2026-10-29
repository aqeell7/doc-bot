import { client } from "./openai"

export async function embedTexts(texts: string[]): Promise<number[][]> {
    // If the list is empty, return an empty array without calling the API
    if (texts.length === 0) {
        return [];
    }

    const embedding = await client.embeddings.create({
        model: "text-embedding-3-small",
        input: texts,
        // dimensions: 3 removed so we get the full 1536 rich semantic details
    });

    console.log("Total Tokens Used:", embedding.usage.total_tokens);

    // Extract and return just the list of embedding vectors
    return embedding.data.map(item => item.embedding);
}