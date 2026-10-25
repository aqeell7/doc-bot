import OpenAI from "openai";
import "dotenv/config";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const openai = new OpenAI({
    apiKey: OPENAI_API_KEY
});

// 1. Move the API call into its own reusable function
async function embedTexts(texts: string[]): Promise<number[][]> {
    // If the list is empty, return an empty array without calling the API
    if (texts.length === 0) {
        return [];
    }

    const embedding = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: texts,
        // dimensions: 3 removed so we get the full 1536 rich semantic details
    });

    console.log("Total Tokens Used:", embedding.usage.total_tokens);

    // Extract and return just the list of embedding vectors
    return embedding.data.map(item => item.embedding);
}

// 2. Cosine similarity function
function cosineSimilarity(a: number[], b: number[]): number {
    // Fixed typo from "lenght" to "length"
    if (a.length !== b.length || a.length === 0 || b.length === 0) {
        throw new Error("Arrays must be of the same length and cannot be empty");
    }

    let dot = 0;
    let sumA = 0;
    let sumB = 0;

    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        sumA += a[i] * a[i];
        sumB += b[i] * b[i];
    }

    const lenA = Math.sqrt(sumA);
    const lenB = Math.sqrt(sumB);

    // Guard against division by zero (prevents returning NaN)
    if (lenA === 0 || lenB === 0) {
        throw new Error("Vector magnitude cannot be zero.");
    }

    return dot / (lenA * lenB);
}

async function main() {
    // Use the real test words
    const vectors = await embedTexts(["dog", "puppy", "invoice"]);

    // Expect 1536 dimensions now that we removed the 3-dimension limit
    console.log("Vector 0 length:", vectors[0].length); 

    // Compare semantic similarities using the proper vectors
    console.log("dog vs puppy:", cosineSimilarity(vectors[0], vectors[1]));
    console.log("dog vs invoice:", cosineSimilarity(vectors[0], vectors[2]));
}

// Catch errors cleanly if anything fails
main().catch(console.error);