import { pool } from "../lib/db";
import { retrieve } from "../lib/retrieve";
import { answerQuestion } from "../lib/answer";

async function ask() {
  // --- PART 1: Put this near the top of ask() ---
  const debug = process.argv.includes("--debug");

  const question = process.argv[2];
  if (!question) {
    console.log('usage: npm run ask -- "your question"');
    return;
  }

  try {
    // 1. RETRIEVE: the librarian brings the 5 closest chunks
    const chunks = await retrieve(question, 5);

    // --- PART 2: ---
    // Show what the librarian actually brought, so you can tell 
    // "wrong pages" apart from "right pages, wrong answer".
    if (debug) {
      console.log("\nRETRIEVED:");
      chunks.forEach((c, i) => {
        console.log(`[${i + 1}] (${c.similarity.toFixed(2)}) ${c.content.slice(0, 150).replace(/\s+/g, " ")}...`);
      });
    }

    // 2 + 3. AUGMENT + GENERATE: the student answers from them
    const answer = await answerQuestion(question, chunks);

    console.log("\nANSWER:\n" + answer);

    // 4. CITE: OUR code turns [1]..[5] back into real addresses.
    console.log("\nSOURCES:");
    chunks.forEach((c, i) => {
      const where = c.page ? `${c.source}, page ${c.page}` : c.source;
      console.log(
        `[${i + 1}] ${where}, chunk ${c.position} (score ${c.similarity.toFixed(2)})`
      );
    });
  } finally {
    await pool.end();
  }
}

ask().catch(console.error);