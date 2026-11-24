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

CREATE TABLE IF NOT EXISTS chunks (
  id        bigserial PRIMARY KEY,
  source    text NOT NULL,
  position  integer NOT NULL,
  content   text NOT NULL,
  embedding vector(1536) NOT NULL
);

ALTER TABLE chunks ADD COLUMN IF NOT EXISTS page integer;

-- =====================================================================
-- Week 2 S1 — keyword (full-text) search
-- =====================================================================
-- content_tsv = a ready-made "word index card" for each chunk.
-- to_tsvector('english', content) cuts the text into words, drops tiny
-- words ("the", "is"), and trims each word to its root
-- ("refunds", "refunded" -> "refund").
-- GENERATED ALWAYS ... STORED = Postgres fills this column by itself,
-- for the 22 rows already in the table AND every future insert.
-- So: no re-ingest needed, and insertChunk stays the same.
ALTER TABLE chunks ADD COLUMN IF NOT EXISTS content_tsv tsvector
  GENERATED ALWAYS AS (to_tsvector('english', content)) STORED;

-- GIN index = the "back-of-the-book index" for words: word -> which rows.
-- Not needed at 22 rows, but it's the standard partner of a tsvector column.
CREATE INDEX IF NOT EXISTS chunks_content_tsv_idx ON chunks USING gin (content_tsv);

-- =====================================================================
-- Week 3 S1 — semantic cache (the clerk's notebook)
-- =====================================================================
CREATE TABLE IF NOT EXISTS answer_cache (
  id            bigserial PRIMARY KEY,
  question      text NOT NULL,          -- the question as the user typed it
  source_filter text,                   -- NULL = all docs; else e.g. 'nimbus-admin-guide.pdf'
  embedding     vector(1536) NOT NULL,  -- the question's meaning-address
  answer        text NOT NULL,          -- the full finished answer
  sources       text NOT NULL,          -- the sources list (JSON text) shown under the answer
  created_at    timestamptz NOT NULL DEFAULT now()
);