# Doc Bot — NOTES (the whole RAG stack)

My study notes for interviews and refreshers. Plain words, my real numbers.
The short story version is in `docs/rag-decisions.md`; this file is the reference.

**Contents:** 1 Pipeline map · 2 Embeddings · 3 pgvector + indexes · 4 Chunking · 5 Ingestion · 6 Retrieval, citations, refusal · 7 Hybrid search · 8 Re-ranking · 9 Query rewriting · 10 Streaming UI + input guards · 11 Semantic cache · 12 Cost & time model · 13 Diagnosis rule + failure log · 14 Quick-fire Q&A

---

## 1. Pipeline map

```
INGEST (once):  data/docs/*.md, *.pdf → parse (per page) → chunk (500/100) → embed → chunks table

ASK (CLI, src/scripts/ask.ts):
question → [rewrite] → hybrid search (5, or 20 if rerank) → [rerank → 5] → answerQuestion → sources → STAGES bill

WEB (src/app/api/chat/route.ts):
question → guards → semantic cache ──hit──→ saved answer
                         └─miss→ hybrid search (5) → 0 chunks? instant refusal
                                 → streamAnswer (low effort) → browser → save to cache
```

| File | Job |
|---|---|
| `lib/db.ts` | one shared Postgres pool (always `pool.end()` in scripts) |
| `lib/openai.ts` | one shared OpenAI client |
| `lib/embed.ts` | `embedTexts`, `embedInBatches`, global `usage.tokens` counter |
| `lib/chunk.ts` | `chunkFixed`, `chunkWithOverlap` (mine) |
| `lib/parse.ts` | Markdown + PDF (unpdf, per page) |
| `lib/store.ts` | `insertChunk` |
| `lib/retrieve.ts` | `vectorSearch`, `keywordSearch`, `retrieve` (hybrid + source filter) |
| `lib/merge.ts` | `mergeResults` (RRF), `takeTurns` (round-robin) (mine) |
| `lib/rerank.ts` | `pickChunks` (mine) + LLM rerank |
| `lib/rewrite.ts` | `rewriteQuestion` (minimal effort) |
| `lib/answer.ts` | 6-rule system prompt, `answerQuestion`, `streamAnswer` |
| `lib/citations.ts` | `parseCitations` (mine), browser-safe |
| `lib/refusal.ts` | the one refusal sentence, shared by server + browser |
| `lib/cache-check.ts` / `cache.ts` | `pickCacheHit` (mine) / lookup + save |
| `lib/stage-report.ts` / `meter.ts` | `addUp` (mine) / prices + `recordChat`, `recordEmbed` |

---

## 2. Embeddings

- **What:** a list of numbers that is a text's *address on a meaning map*. Similar meanings → nearby addresses.
- **Model:** `text-embedding-3-small` → **1536 numbers** per text. Price $0.02 / 1M tokens.
- **Closeness:** cosine similarity = "do two arrows point the same way?" 1 = same, 0 = unrelated. It ignores length.
- **One call for many texts:** `embedTexts(["a","b"])` → `[[...],[...]]`, same order as the input. Fewer network trips.
- **Cost proof:** embedding all 22 chunks = 2088 tokens = **$0.000042**.
- **Gotchas:**
  - `dimensions: 3` squashed the meaning → "cow" vs "invoice" scored −0.9. Use the default 1536.
  - Low scores are a noisy band. Only trust the **top** of the list, never "0.3 vs 0.25".
  - An embedding sees only the text. It knows **words + topic**, not "what the answer is" (see §11).
  - Cross-language is weak: a Hindi question scored ~0.11 against English chunks.

## 3. pgvector + indexes

- **What:** a Postgres add-on: a `vector(1536)` column and the `<=>` operator (cosine **distance**: 0 = identical).
- **Why I chose it:** one database for everything. Text, embedding, source, page, position and the keyword index live in **one table**, filters are one `WHERE` line, and there's no second service.
- **Query shape:** `SELECT ..., 1 - (embedding <=> $1) AS similarity ... ORDER BY embedding <=> $1 LIMIT k`
  - `1 - distance` = similarity (1 = identical)
  - `ORDER BY` distance **ascending** (smallest = closest). Adding `DESC` would give the *worst* first.
  - Without `ORDER BY`, `LIMIT 5` returns any random 5 rows.
- **Passing a vector:** `JSON.stringify(vec)` → the text `"[0.1,-0.3,...]"`, which pgvector reads.
- **Placeholders:** `$1, $2` + a values array → no SQL injection.
- **Indexes:**
  - none at 22 rows: checking every row (exact search) is instant
  - **HNSW** = an approximate index: much faster on huge tables, might miss a perfect match (speed vs exactness), built once
  - the operator class must match the query: `vector_cosine_ops` for `<=>`, or the index is silently ignored
- **When to switch to a separate vector DB:** millions of vectors, heavy traffic, or Postgres getting slow. Not at my scale.

## 4. Chunking

- **Chunk** = a small piece of a document. Search finds pieces, not whole files.
- **Setting:** `chunkWithOverlap(text, 500, 100)` = **500 characters** per chunk, **100 characters** overlap (characters, not tokens).
- **Why overlap:** every chunk after the first starts with the last 100 characters of the one before. A fact cut at an edge is still whole in the next chunk. This is guaranteed only for facts up to ~100 characters long; longer facts can still be split.
- **Worked example (size 10, overlap 3):** `ABCDEFGHIJKLMNOPQRS` → `ABCDEFGHIJ`, `HIJKLMNOPQ`, `OPQRS`. "HIJ" and "OPQ" appear twice.
- **Proof:** handbook gave 13 fixed vs 16 overlap chunks. **Overlap won 4/4 questions.** Refund scored 0.72 vs 0.64, because the fixed chunk lost the start of the yearly-Plus rule. In the 22-question failure hunt, **0 chunking failures**.
- **Gotchas:**
  - overlap ≥ size → infinite loop. My function throws instead.
  - always handle the tail (the last short piece)
  - Windows `\r\n` line endings turned 16 chunks into 17 (same text, more characters)
- **Price:** more chunks and some repeated text (more to embed and store).

## 5. Ingestion

- `npm run ingest` → for each file in `data/docs`: parse → chunk → **delete that file's old rows** → embed in batches of 100 → insert.
- **PDF:** parsed **per page**, so each chunk keeps its page number → citations like "admin-guide.pdf, page 3".
- **Delete before insert:** makes ingest safe to re-run (no duplicates).
- **source + position** on each row → "which file, which chunk" for citations and for spotting the same chunk in two lists.
- **Result:** 22 chunks (handbook 17 + PDF 5), 2088 tokens, $0.000042.
- **Gotcha:** the page column first came out NULL for the PDF rows because `insertChunk` didn't pass `page`. Check new columns after a run.

## 6. Retrieval, citations, refusal

- **Retrieve** = find the top-k chunks for a question. **Augment** = paste them, numbered, into the prompt. **Generate** = the model answers from them.
- **Context shape:** `[1] chunk text ... [2] chunk text ...` + `Question: ...`
- **Writer rules (6):** only use the context; cite `[n]` after each fact; include every relevant fact; partial answer + say what's missing; if nothing answers → reply exactly the refusal sentence; never repeat.
- **Key truth:** the database **always** returns k chunks, even for "capital of France". So "I don't know" must come from the **prompt**, not the search.
- **Off-topic idea:** a top-score threshold could skip the LLM for clear junk (France top 0.09), but not for near-topic questions (dark mode 0.50).
- **Citations in the UI:** `parseCitations` splits on `[n]` and accepts only 1..sourceCount. The model once cited [6] with 5 passages. **Prompt rules are requests; the code check is the guarantee.**
- **Sources travel** in the `X-Sources` header (`encodeURIComponent(JSON.stringify(...))`), so the body can stream.
- **0 chunks** (e.g. a filter to a missing file) → instant refusal, **no model call**.

## 7. Hybrid search

- **Vector search** = same **meaning**. Good when the user's words differ from the docs ("money back" vs "refund"). Blurs exact names.
- **Keyword search** = same **words** (Postgres full-text). Good for exact names and terms (Entra, SSO, error codes).
- **Keyword setup:**
  - `content_tsv` = a generated column: `to_tsvector('english', content)`, which keeps word roots, drops tiny words, and fills itself
  - **GIN index** = back-of-the-book index (word → rows)
  - question → `what | can | free | plan` (`|` = OR; AND would match almost nothing)
  - only a–z/0–9 kept → a Hindi question gives **no keyword query** (vector only)
  - `ts_rank` scores are **not** on the 0–1 cosine scale; bigger is better (`DESC`)
- **Hybrid:** run both (each fetches k×2 candidates, in parallel), then merge with **RRF (reciprocal rank fusion)**: points for **position** in each list, not raw score.

  | Rank in a list | Points |
  |---|---|
  | 1st | 0.0164 |
  | 2nd | 0.0161 |
  | 3rd | 0.0159 |
  | 5th | 0.0154 |
  | 10th | 0.0143 |

  A chunk found by **both** searches adds both: e.g. 1st + 2nd = **0.0325**. (That's why my sources show "scores" like 0.033.) You don't need the formula; just know that higher rank = more points, and being in both lists wins.
- **Why position, not score:** cosine (0–1) and ts_rank (tiny numbers) are different scales. Adding them is apples + oranges.
- **Evidence:** F2 "What can't I do on Free?" went from 1 fact → 5; the view-only sharing fact came from chunk #10, which only hybrid found; Entra found by keyword at rank 3. F5 billing: no gain.

## 8. Re-ranking

- **Idea:** the résumé screen, then the interview. Search grabs **20** candidates fast (cheap DB query). The LLM reads all 20 and returns the best **5** as JSON `{"ranking":[7,2,...]}`.
- **`pickChunks` (mine):** skip invalid numbers (not an integer, out of range), skip duplicates, stop at k, and if nothing valid is left → fall back to search's own top k.
- **Evidence:** F3 Hindi **fixed** (chunk 7 → [1]); F5 billing partly better (gained refunds, lost taxes/renewal); F1/F2 no change; F6 typo slightly worse. **+4.8–9.2 s.**
- **Cost (S2):** reads ~2,200 tokens, writes ~1,100 (98% thinking) → ~$0.00055, ~6.7 s, **35% of a full request's cost**.
- **Gotchas:**
  - it can't fix writer problems (F2)
  - it never changes chunk text, only the order and the cut
  - with 22 chunks, 20 candidates ≈ the whole database (matters more as docs grow)

## 9. Query rewriting

- **Idea:** the LLM turns the question into **1–3 clean English search queries** (fix typos, translate, make vague → specific, split visible multi-part questions).
- **Search uses the rewrites; the re-ranker and writer get the ORIGINAL question.** The user's real wording, details and language are what must be answered.
- **Several queries:** search each, then `takeTurns` (mine) = round-robin across the lists, skipping duplicate ids, until k.
- **`readQueries`:** broken JSON or an empty list → fall back to the original question.
- **Evidence:** cleaned the wording 5/5. Can only split **visible** multi-part questions (hidden multi-hop needs other fixes). F2 never split; its chunks were already retrieved (a writer problem).
- **Cost:** `reasoning_effort: "minimal"` → ~1.7 s, ~22 output tokens, ~$0.00002 (10× cheaper, 3× faster than default). But minimal ignored a complex "broad question" rule.

## 10. Streaming UI + input guards

- **Streaming:** `streamAnswer` = an async generator (`stream: true`, yields `delta.content`) → the route pushes pieces into a `ReadableStream` → the browser reads with a reader loop + `TextDecoder({stream:true})`.
- **Search happens BEFORE the pipe opens**, so a search failure can still return a proper 500.
- **Measuring gotcha:** browser `fetch` resolves at the **first piece**, not when the pipe opens → log stage timings on the **server**.
- **Writer effort (web):** default 10–18 s to the first word (all thinking); minimal 2–4 s but wrongly refused billing; **low = 2.2–6 s, correct → chosen.**
- **Guards:** empty → 400; not JSON → 400; >1000 characters → 400 (checked on the server **too**); optional source filter.
- **SQL injection:** blocked by `$1` placeholders + keyword sanitising.
- **Prompt injection:** only **reduced**, never solved: system rules, question kept as data, no tools/secrets, React escapes text.

## 11. Semantic cache

- **Idea:** the clerk's notebook. Save (question embedding, answer, sources). If a new question is close enough to a saved one, return the saved answer and skip search + writer.
- **Threshold** = the minimum similarity score to reuse an answer. Too loose → **wrong hits** (fast, confident, wrong). Too tight → few hits.
- **How I chose it:** a probe of SAME vs DIFFERENT pairs, then the line goes **just above the highest DIFFERENT score**.

  | Score | Kind | Pair |
  |---|---|---|
  | 0.932 | DIFFERENT | monthly ⟷ yearly Plus refund |
  | 0.836 | DIFFERENT | Free ⟷ Plus file limit |
  | 0.771 | SAME | dark mode ⟷ dark theme |
  | 0.645 | SAME | refund window ⟷ how long to ask for a refund |
  | 0.564 | SAME | SSO ⟷ single sign-on |

  No gap → **threshold 0.95** → only exact repeats hit (even a lowercase copy missed).
- **Results:** hit 0.5–1.4 s vs miss 4–13 s; the yearly question correctly missed.
- **Rules:** never save refusals or errors; the source filter is part of the key (`IS NOT DISTINCT FROM`, so NULL = NULL); `TRUNCATE answer_cache;` after re-ingest or a prompt change; a broken cache must never break the bot.
- **Why search tolerates "close" but the cache doesn't:** search has the writer as a judge; a cache hit goes **straight to the user**.
- **Real fix (capstone):** rewrite to a standard wording first, or key-word checks (yearly/monthly, Free/Plus).

## 12. Cost & time model

**One rule: an LLM step = reading (input) + writing (output, including hidden thinking).**
- Reading is fast and cheap ($0.05 / 1M).
- Writing is slow (~**170 tokens per second** on nano) and **8× the price** ($0.40 / 1M).
- Ask: *how much does this step write + think?* That decides most of the time and cost.

| Output tokens (incl. thinking) | ≈ time | ≈ cost |
|---|---|---|
| 30 | ~1 s (mostly network) | $0.00002 |
| 1,000 | ~6 s | $0.0005 |
| 2,500 | ~14 s | $0.001 |

| Step | Reads | Writes + thinks | Effort | Time | Cost |
|---|---|---|---|---|---|
| retrieve | 12-token embedding + 2 DB queries | — | — | 0.5–3 s | ~$0 |
| rewrite | ~200 | ~27 | minimal | 1.7–3.3 s | $0.00002 |
| rerank | ~2,200 | ~1,100 (98% thinking) | default | 5–9 s | $0.00055 |
| generate (CLI) | ~500 | ~2,500 (95% thinking) | default | ~14 s | $0.001 |
| generate (web) | ~500 | much less | low | 2–6 s | not measured |
| cache hit | 1 embedding + 1 DB query | — | — | 0.5–1.4 s | ~$0 |

- **Surprise:** rerank reads 4× more than generate, but generate costs 2× more. Writing beats reading.
- **Averages (6 questions):** basic $0.0006 / 8.6 s; full $0.0015 / 21.7 s → **$0.61 vs $1.45 per 1,000 questions.**
- **Refusals aren't free:** France still cost $0.00015–0.0003.
- **Levers, biggest first:** (1) the thinking setting, (2) fewer LLM calls (cache, off-topic skip), (3) less input.
- **Guessing rules:**
  - no LLM → ≤1–3 s, ~free
  - minimal → 1–2 s
  - low → 2–6 s
  - default → 5–15 s, $0.0005–0.001

## 13. Diagnosis rule + failure log

```
Is the right chunk in the SOURCES?
  not in top 20         → fix search / chunking / rewrite
  in top 20, not top 5  → fix re-rank
  in top 5, answer wrong → fix the writer prompt
```
Always check SOURCES before blaming retrieval.

| Failure | Cause | Status |
|---|---|---|
| "Is it free?", Team after 2 months | over-strict refusal | partial-answer rule fixed F4 |
| "What can't I do on Free?", "Tell me everything about billing" | broad question vs top-5 | partly helped by hybrid/rerank; F2 is now a **writer** problem |
| Hindi refund | cross-language (~0.11) | fixed by rerank (CLI); web has no rerank yet |
| typo refund | over-answering | minor |
| cited [6] with 5 passages | model ignored a rule | code range check |
| billing repeats a fact / trailing "I don't know" | writer | partly fixed |
| semantic cache paraphrases | embeddings ≠ "same answer" | threshold 0.95, real fix in capstone |

Failure hunt: **22 questions, 16 passed.** One run per question = weak evidence; answer wording varies run to run.

## 14. Quick-fire Q&A

- **Why overlap?** So a fact cut at a chunk edge is still whole in the next chunk (for facts up to ~the overlap size).
- **Why pgvector, not a vector DB?** One database for text + vectors + keywords + metadata; SQL filters; no extra service. A separate vector DB makes sense at millions of vectors.
- **Why no HNSW?** 22 rows: exact search is instant. HNSW trades exactness for speed at large scale.
- **Why ORDER BY distance without DESC?** `<=>` is distance, so smallest = closest.
- **Why merge by position, not by adding scores?** Cosine and ts_rank are on different scales.
- **When do keywords win? Meaning?** Keywords: exact names/terms. Meaning: when the user's words differ from the docs.
- **Why fetch 20, not all, for rerank?** The LLM interview is slow and costly per passage, and big docs won't fit. Search is a cheap screen.
- **Why does the writer get the original question, not the rewrite?** The rewrite is for search; the answer must match what the user actually asked (details, language).
- **Why can't the database say "I don't know"?** It always returns k chunks; refusal must come from the prompt (or a score threshold).
- **Why check citation numbers in code?** Prompt rules are requests; code is the guarantee.
- **Why does the server re-check length when the box already limits it?** Anyone can skip the browser (curl). The server never trusts the client.
- **Why does the browser call /api/chat, not OpenAI?** The API key must stay on the server.
- **Why did the cache need 0.95?** A different-answer pair scored 0.932; the line must sit above every wrong match.
- **What controls most of the cost AND the wait?** Output tokens, mostly hidden thinking, so the `reasoning_effort` setting.
- **Why does rerank (reads 20) cost less than the writer (reads 5)?** The writer writes + thinks more, and output is 8× the price.