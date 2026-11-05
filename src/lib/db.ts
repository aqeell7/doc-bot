// =====================================================================
// src/lib/db.ts — ONE shared connection to Postgres (Neon)
// Glue file.
// =====================================================================

import pg from "pg";

// A "pool" = a small group of ready-to-use database connections.
// Analogy: a taxi stand. Instead of calling a new taxi for every trip
// (slow), a few taxis wait at the stand and get reused.
//
// connectionString = the long postgresql://... URL from Neon, read from .env.
//
// GOTCHA: an open pool keeps your script alive forever. Every script
// must call `await pool.end()` when it's done, or it will "hang".
export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});