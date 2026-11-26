# Building a RAG bot in TypeScript: the decisions, the failures, and the numbers

## 1. What I built

Doc Bot answers questions about Nimbus Notes, a made-up note-taking app, using only its help docs. Every fact in an answer cites the passage it came from. When the docs don't cover a question, the bot says "I don't know based on the documents." The docs are one Markdown handbook and one PDF admin guide, split into 22 chunks. It is built with TypeScript and Next.js, stores everything in Postgres on Neon with pgvector, and uses OpenAI's text-embedding-3-small for embeddings and gpt-5-nano for writing.

The pipeline: question → (rewrite) → hybrid search → (re-rank) → answer with citations → streamed to the browser.

## 2. Chunking: 500 characters with 100 of overlap

Search doesn't find whole files. It finds chunks: small pieces of a document. My first chunker cut the text every 500 characters, but a cut can land in the middle of a fact. So I switched to overlap: every chunk after the first starts with the last 100 characters of the one before it. If a short fact is cut at the edge of one chunk, the next chunk still has it whole.

I tested both on the handbook. Fixed-size gave 13 chunks, overlap gave 16, and overlap won all 4 test questions. On the refund question it scored 0.72 against 0.64, because the fixed chunk had cut off the start of the yearly-Plus refund rule. Later, in a 22-question failure hunt, not one failure came from chunking. The price is a few extra chunks with some repeated text.

## 3. Why pgvector

pgvector is an add-on that lets Postgres store embeddings and sort rows by how close they are to a question. I chose it because it keeps everything in one place. One table holds each chunk's text, its embedding, its file name, page and position, and a word index for keyword search. Filtering by document is one WHERE line, and there is no second service to run.

I added no vector index. With 22 rows, checking every row is instant. An index like HNSW trades a little accuracy for a lot of speed, and it only matters at thousands or millions of rows. That is also the scale where a separate vector database starts to make sense.

## 4. What hybrid search fixed

Vector search finds chunks that mean the same as the question. It works when the user's words differ from the docs ("money back" vs "refund"), but it blurs exact names and terms. Keyword search, using Postgres full-text search, finds chunks that use the same words. Hybrid search runs both and merges the two lists. The merge (reciprocal rank fusion) gives each chunk points for its position in each list, not its raw score, because the two searches score on different scales.

On "What can't I do on the Free plan?", the answer went from 1 fact to 5. The view-only sharing fact came from a chunk that only hybrid search found. An exact product name, Entra, was found by keyword search. A broad billing question did not improve.

## 5. What re-ranking and rewriting fixed

Re-ranking works like hiring: search quickly screens and keeps 20 candidates, then the LLM reads those 20 and keeps the best 5. Sending every chunk to the LLM would cost more and take longer, and with 1,000 chunks it would not fit. (With only 22 chunks, 20 is almost everything; this matters more as the docs grow.)

Re-ranking fixed a Hindi refund question: the right chunk moved from outside the top 5 to first place. The billing question gained all the refund rules but lost two other facts. Two questions did not change and one got slightly worse. It added 5–9 seconds.

Rewriting turns the question into 1–3 clean English search queries. It fixed typos, translated Hindi and made vague questions specific, but it can only split a question that visibly asks two things.

## 6. Failure modes I met

I ran 22 tricky questions and 16 passed. The failures were refusals of questions the docs did answer ("Is it free?"), broad questions that need more than 5 chunks, and questions in another language (Hindi scored about 0.11).

The most useful habit was checking the sources before blaming search. If the right chunk is not in the top 20, search or chunking is the problem. If it is in the top 20 but not the top 5, the re-ranker is. If it is in the top 5 and the answer is still wrong, the writer prompt is. One question was a writer problem: the facts were in the passages and the model ignored them.

Another bug: the model cited [6] when it only had 5 passages. A prompt rule asked it not to, but only a code check that accepts 1 to 5 can guarantee it.

## 7. The numbers

An average question costs $0.0006 with the basic pipeline and $0.0015 with rewrite and re-rank: $0.61 vs $1.45 per 1,000 questions. Money is cheap. Time is the real cost: 8.6 s vs 21.7 s per answer.

In one full request, the writer took 51% of the time and 64% of the cost, and re-ranking 25% and 35%. 95–98% of their output was hidden "thinking", and output costs 8 times more than input. So the reasoning-effort setting controls most of the bill and most of the wait. On the web writer, "minimal" was fast but wrongly refused a billing question; "low" (2–6 s) stayed correct.

I also tried a semantic cache. Paraphrases scored 0.56–0.77, but questions with different answers scored up to 0.93 (monthly vs yearly refunds). The only safe threshold, 0.95, catches just exact repeats, in about 1 second instead of 4–13.

## 8. What I'd do next

Build an evals harness, a scored test set, instead of judging answers by eye. Then use it to measure a lower thinking setting on the re-ranker, and re-ranking in the web route.