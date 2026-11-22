
import { retrieve } from "../../../lib/retrieve";
import { streamAnswer } from "../../../lib/answer";

// pg needs real Node.js (not Next's lightweight "edge" runtime)
export const runtime = "nodejs";

export async function POST(req: Request) {
  const t0 = Date.now();

  // 1. Read the question. Missing or empty → 400
  const body = await req.json().catch(() => null);
  const question =
    typeof body?.question === "string" ? body.question.trim() : "";

  if (!question) {
    return Response.json(
      { error: "Please type a question." },
      { status: 400 }
    );
  }

  // 2. Search BEFORE opening the pipe
  let chunks;

  try {
    chunks = await retrieve(question, 5, "hybrid");
  } catch (err) {
    console.error("search failed:", err);
    return Response.json({ error: "Search failed." }, { status: 500 });
  }

  console.log(`search: ${Date.now() - t0} ms`);

  // 3. Open pipe 2 and push OpenAI's pieces through it
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let pieces = 0;

      try {
        for await (const piece of streamAnswer(question, chunks)) {
          if (pieces === 0) {
            console.log(`first piece: ${Date.now() - t0} ms`);
          }

          pieces++;
          controller.enqueue(encoder.encode(piece));
        }
      } catch (err) {
        console.error("answer stream failed:", err);

        controller.enqueue(
          encoder.encode(
            "\n\n[Sorry, something went wrong while writing the answer.]"
          )
        );
      } finally {
        console.log(`done: ${Date.now() - t0} ms, ${pieces} pieces`);
        controller.close();
      }
    },
  });

  // 4. Send the pipe to the browser right away
  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
