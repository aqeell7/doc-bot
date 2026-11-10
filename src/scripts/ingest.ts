import { readdirSync } from "node:fs";
import { pool } from "../lib/db";
import { parseFile } from "../lib/parse";
import { embedInBatches, usage } from "../lib/embed";
import { chunkWithOverlap } from "../lib/chunk";
import { insertChunk } from "../lib/store";

async function ingest() {
  // 1. Read all files in data/docs, keeping only .md and .pdf
  const files = readdirSync("data/docs").filter(
    (f) => f.endsWith(".md") || f.endsWith(".pdf")
  );

  let totalChunks = 0;

  try {
    for (const file of files) {
      console.log(`Processing: ${file}...`);
      
      // Parse file (handles both Markdown and PDFs automatically)
      const pages = await parseFile("data/docs/" + file);

      // Flatten pages into chunk rows with their respective page numbers
      const rows: { page: number | null; content: string }[] = [];
      for (const p of pages) {
        for (const chunk of chunkWithOverlap(p.text, 500, 100)) {
          rows.push({ page: p.page, content: chunk });
        }
      }

      // Remove old chunks for this file to prevent duplicates
      await pool.query("DELETE FROM chunks WHERE source = $1", [file]);

      // Embed all chunks in batches of 100
      const vectors = await embedInBatches(
        rows.map((r) => r.content),
        100
      );

      // Save each chunk to the database with its position, page, and vector
      for (let i = 0; i < rows.length; i++) {
        await insertChunk(file, i, rows[i].page, rows[i].content, vectors[i]);
      }

      console.log(`-> ${file}: ${rows.length} chunks`);
      totalChunks += rows.length;
    }

    // Calculate total cost using the global usage tracker ($0.02 per 1M tokens)
    const cost = (usage.tokens / 1_000_000) * 0.02;
    console.log(
      `\nTOTAL: ${totalChunks} chunks, ${usage.tokens} tokens, $${cost.toFixed(6)}`
    );
  } finally {
    await pool.end();
  }
}

ingest().catch(console.error);