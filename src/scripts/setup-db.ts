// src/scripts/setup-db.ts — create every table the bot needs, from src/db/schema.sql
import { readFileSync } from "node:fs";
import { pool } from "../lib/db";

async function setupDb() {
  const sql = readFileSync("src/db/schema.sql", "utf-8");
  try {
    await pool.query(sql); // runs every statement in the file, top to bottom
    console.log("Database ready: pgvector on, tables created (chunks, answer_cache + practice tables).");
  } finally {
    await pool.end();
  }
}

setupDb().catch((err) => {
  console.error("Setup failed:", err.message);
  process.exitCode = 1;
});
