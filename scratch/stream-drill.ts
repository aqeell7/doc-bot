export {}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// A FAKE model: hands out 5 pieces, 0.3 s apart (like OpenAI does, but free)
async function* fakeModel(): AsyncGenerator<string> {
  for (const p of ["Yearly", " Plus", " can be", " refunded", " within 14 days."]) {
    await sleep(300);
    yield p;
  }
}

// A BROKEN model: one piece, then the connection dies
async function* brokenModel(): AsyncGenerator<string> {
  await sleep(300);
  yield "Yearly Plus";
  await sleep(300);
  throw new Error("connection lost");
}

// ---------- SERVER SIDE: the joint between the pipes ----------
function makePipe(pieces: AsyncGenerator<string>): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      try {
        for await (const piece of pieces) {
          // turn the piece into bytes and push it into the pipe
          controller.enqueue(encoder.encode(piece))
        }
      } catch {
        // too late for an error status, so push a short error message
        //          as bytes: "\n[Sorry, something went wrong while writing the answer.]"
        controller.enqueue(encoder.encode("\n[Sorry, something went wrong while writing the answer.]"))
      } finally {
        // close the pipe, so the reader knows the answer is finished
        controller.close();
      }
    },
  });
}

// ---------- BROWSER SIDE: the glass at the end of the pipe ----------
async function readPipe(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let text = "";
  const started = Date.now();

  while (true) {
    // wait for the next piece from the reader (you get back done + value)
    const {done, value} = await reader.read()
    // if done is true, leave the loop
    if(done) break;
    // turn value (bytes) into text, with stream: true, and add it to `text`
    text += decoder.decode(value, { stream: true });
    console.log(`  ${String(Date.now() - started).padStart(4)} ms →`, JSON.stringify(text));
  }
  return text;
}

// ---------- the tests ----------
console.log("Test 1: a normal answer");
await readPipe(makePipe(fakeModel()));
console.log("  finished ✓");

console.log("\nTest 2: the model fails halfway");
await readPipe(makePipe(brokenModel()));
console.log("  finished ✓ (no hang)");

console.log("\nTest 3: why decode needs { stream: true }   (given, just watch)");
const bytes = new TextEncoder().encode("रिफंड");
const part1 = bytes.slice(0, 4);   // cut in the MIDDLE of the 2nd letter
const part2 = bytes.slice(4);
const plain = new TextDecoder();
console.log("  without stream:true →", JSON.stringify(plain.decode(part1) + plain.decode(part2)));
const smart = new TextDecoder();
console.log("  with    stream:true →", JSON.stringify(smart.decode(part1, { stream: true }) + smart.decode(part2, { stream: true })));