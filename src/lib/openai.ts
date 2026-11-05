// =====================================================================
// src/lib/openai.ts — ONE shared OpenAI client for the whole project
// Glue file. Every other file imports `client` from here, so the key
// and settings live in one place.
// =====================================================================

import OpenAI from "openai";

// dotenv/config reads the ".env" file and copies its lines into
// process.env. Your npm scripts ALSO load .env with --env-file=.env,
// so this line is a backup for when you run a file with plain
// `npx tsx file.ts` (no flag). Rule to remember:
// ONE secret file, ONE name. "not found" = file-name mismatch.
import "dotenv/config";

// process.env.X reads an environment variable. It's `string | undefined`
// because the variable might not be set.
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// `export` lets other files do: import { client } from "./openai"
export const client = new OpenAI({
  apiKey: OPENAI_API_KEY,
});