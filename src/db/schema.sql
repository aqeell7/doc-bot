-- =====================================================================
-- db/schema.sql — the database tables for doc-bot
-- Run this once in the Neon SQL Editor. Kept here so the repo
-- records exactly what the database looks like.
-- =====================================================================

-- Turn on the pgvector add-on. Without this, Postgres has no "vector"
-- column type and no <=> closeness operator.
-- "IF NOT EXISTS" = safe to run again; it won't error if already on.
CREATE EXTENSION IF NOT EXISTS vector;

-- The real table for the bot.
CREATE TABLE IF NOT EXISTS sentences (
  -- bigserial = a number the database fills in by itself (1, 2, 3...).
  -- PRIMARY KEY = it's the unique ID of each row.
  id        bigserial PRIMARY KEY,

  -- The original text. NOT NULL = this column can never be empty.
  content   text NOT NULL,

  -- The embedding. vector(1536) = a list of EXACTLY 1536 numbers.
  -- 1536 matches text-embedding-3-small. Send any other length and
  -- Postgres refuses the insert (a loud error, which is good).
  embedding vector(1536) NOT NULL
);

-- Practice table for the scratch drill: tiny 3-number vectors typed by hand.
CREATE TABLE IF NOT EXISTS drill_vectors (
  id        bigserial PRIMARY KEY,
  label     text NOT NULL,
  embedding vector(3) NOT NULL
);

-- NOTE: no index yet. With 50 rows, checking every row is instant.
-- With a large number of rows you'd add an HNSW index, e.g.:
--   CREATE INDEX ON sentences USING hnsw (embedding vector_cosine_ops);
-- "vector_cosine_ops" must match the operator you query with (<=>),
-- otherwise the index is silently ignored.