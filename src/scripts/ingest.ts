import { readFileSync } from "node:fs";
import { pool } from "../lib/db";
import { embedTexts } from "../lib/embed";
import { chunkWithOverlap } from "../lib/chunk";
import { insertChunk } from "../lib/store";

const source = "nimbus-handbook.md";

// The real kitchen: read → chunk → embed → save.
async function ingest() {
  try {
    // 1. Read the document as one string.
    const text = readFileSync("data/docs/" + source, "utf-8");

    // 2. Chunk it with the WINNER from the drill.
    //    (If fixed won in your drill, swap this one line.)
    const chunks = chunkWithOverlap(text, 500, 100);

    // 3. Remove this file's old chunks first, so running ingest twice
    //    doesn't create duplicate rows.
    await pool.query("DELETE FROM chunks WHERE source = $1", [source]);

    // 4. Embed all chunks in ONE call.
    const vectors = await embedTexts(chunks);

    // 5. Save each chunk with its position (0, 1, 2...).
    for (let i = 0; i < chunks.length; i++) {
      await insertChunk(source, i, chunks[i], vectors[i]);
    }

    console.log(`ingested ${chunks.length} chunks from ${source}`);
  } finally {
    await pool.end();
  }
}

ingest().catch(console.error);