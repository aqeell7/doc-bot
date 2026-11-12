import { pool } from "./db";
import { embedTexts } from "./embed";
import { RetrievedChunk } from "./answer";

/**
 * Given a user's question, embeds the text and retrieves the top-k 
 * most relevant chunks from the database using pgvector similarity search.
 */
export async function retrieve(
  question: string,
  k: number = 5
): Promise<RetrievedChunk[]> {
  // 1. Embed the user's question to get its vector representation
  const vectors = await embedTexts([question]);
  const queryEmbedding = vectors[0];

  // 2. Query pgvector for the top-k chunks nearest to the question's vector
  const selectQuery = `
    SELECT source, page, position, content, 1 - (embedding <=> $1) AS similarity
    FROM chunks
    ORDER BY embedding <=> $1
    LIMIT $2
  `;

  const result = await pool.query(selectQuery, [
    JSON.stringify(queryEmbedding),
    k,
  ]);

  // 3. Return the retrieved rows matched to the RetrievedChunk type
  return result.rows;
}