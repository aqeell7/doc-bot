import { retrieve } from "../../../lib/retrieve";
import { streamAnswer } from "../../../lib/answer";
import { REFUSAL } from "../../../lib/refusal";
import type { SourceInfo } from "../../../lib/citations";
import { lookupCache, saveToCache } from "../../../lib/cache";

export const runtime = "nodejs";

const MAX_QUESTION_LENGTH = 1000;

export async function POST(req: Request) {
  const t0 = Date.now();

  // 1. Check the input. The server never trusts that the browser checked.
  const body = await req.json().catch(() => null);
  const question = typeof body?.question === "string" ? body.question.trim() : "";
  if (!question) {
    return Response.json({ error: "Please type a question." }, { status: 400 });
  }
  if (question.length > MAX_QUESTION_LENGTH) {
    return Response.json(
      { error: `Your question is too long (max ${MAX_QUESTION_LENGTH} characters).` },
      { status: 400 }
    );
  }
  const source = typeof body?.source === "string" ? body.source : undefined; // optional filter (S1)

    // 1b. Semantic cache: has a question with the same MEANING been answered before?
  // A broken cache must never break the bot, so a failure just means "no cache this time".
  const cache = await lookupCache(question, source ?? null).catch((err) => {
    console.error("cache lookup failed (carrying on without it):", err);
    return null;
  });

  if (cache?.hit) {
    console.log(
      `cache HIT: ${Date.now() - t0} ms, score ${cache.hit.similarity.toFixed(3)}, matched "${cache.hit.question}"`
    );
    return new Response(cache.hit.answer, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Sources": encodeURIComponent(cache.hit.sources),
        "X-Cache": "hit",
      },
    });
  }
  if (cache) {
    const top = cache.topScore === null ? "none (cache empty)" : cache.topScore.toFixed(3);
    console.log(`cache miss: ${cache.ms} ms, best score ${top}`);
  }

  // 2. Search, before the pipe opens, so a failure can still be a proper 500.
  let chunks;
  try {
    chunks = await retrieve(question, 5, "hybrid", source ? { source } : {});
  } catch (err) {
    console.error("search failed:", err);
    return Response.json({ error: "Search failed." }, { status: 500 });
  }
  console.log(`search: ${Date.now() - t0} ms, ${chunks.length} chunks`);

  // 3. Nothing found → refuse right away. No model call, so it's free and instant.
  if (chunks.length === 0) {
    console.log("no chunks → refused without calling the model");
    return new Response(REFUSAL, {
      headers: { "Content-Type": "text/plain; charset=utf-8", "X-Sources": encodeURIComponent("[]") },
    });
  }

  // 4. The sources list for the browser (goes on the "envelope label").
  const sources: SourceInfo[] = chunks.map((c, i) => ({
    n: i + 1,                       // the same number the writer uses in [n]
    source: c.source,
    page: c.page,
    position: c.position,
    snippet: c.content.slice(0, 400),
  }));

  // 5. Stream the answer, and keep a copy of the full text for the cache.
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let pieces = 0;
      let fullAnswer = "";
      let failed = false;
      try {
        for await (const piece of streamAnswer(question, chunks)) {
          if (pieces === 0) console.log(`first piece: ${Date.now() - t0} ms`);
          pieces++;
          fullAnswer += piece;
          controller.enqueue(encoder.encode(piece));
        }
      } catch (err) {
        failed = true;
        console.error("answer stream failed:", err);
        controller.enqueue(encoder.encode("\n\n[Sorry, something went wrong while writing the answer.]"));
      } finally {
        console.log(`done: ${Date.now() - t0} ms, ${pieces} pieces`);
        controller.close();
      }

      // 6. Save good answers for next time. Runs AFTER close, so the user never waits for it.
      const answer = fullAnswer.trim();
      if (cache && !failed && answer !== "" && answer !== REFUSAL) {
        try {
          await saveToCache(question, source ?? null, cache.embedding, answer, JSON.stringify(sources));
          console.log("cache: saved");
        } catch (err) {
          console.error("cache save failed:", err);
        }
      } else {
        console.log("cache: not saved (refusal, error, or cache was down)");
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Sources": encodeURIComponent(JSON.stringify(sources)), // packed so "—" etc. are safe in a header
    },
  });
}