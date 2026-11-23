// Browser-safe: imports nothing.

// One source as the browser sees it (sent from the server in the X-Sources header).
export type SourceInfo = {
  n: number;
  source: string;
  page: number | null;
  position: number;
  snippet: string;
};

// One piece of the answer: either plain text, or a citation marker like [2].
// In TypeScript, this is called a "discriminated union" because `kind` tells us which shape we have.
export type AnswerPart =
  | { kind: "text"; text: string }
  | { kind: "cite"; n: number; valid: boolean };

// Turns the AI's final answer string into a list of text and citation pieces for the UI.
// Example: "Refund in 14 days [1]." → [text "Refund in 14 days ", cite 1 (valid), text "."]
export function parseCitations(answer: string, sourceCount: number): AnswerPart[] {
  const parts: AnswerPart[] = [];

  // Split the answer everywhere a [number] appears, while KEEPING the [number] in the array.
  // The parentheses ( ) around \[\d+\] tell split() not to throw away the matched marker.
  // Example: "Refund in 14 days [1]." → ["Refund in 14 days ", "[1]", "."]
  const pieces = answer.split(/(\[\d+\])/);

  for (const piece of pieces) {
    // 1. Skip empty strings (these happen when a citation is at the very start/end, or two touch like "[1][2]").
    if (piece === "") continue;

    // 2. Check if this piece is an exact citation marker like "[1]" or "[12]".
    if (/^\[\d+\]$/.test(piece)) {
      // Remove the first "[" and last "]" characters, then turn the remaining digits into a real number.
      // Example: "[12]" → "12" → 12
      const n = Number(piece.slice(1, -1));

      // 3. A citation is only valid if it points to an actual source (between 1 and sourceCount).
      // If the AI hallucinates "[5]" when only 3 sources exist, `valid` becomes false so the UI won't crash.
      const valid = n >= 1 && n <= sourceCount;
      parts.push({ kind: "cite", n, valid });

      // Done with this piece—move on to the next one in the loop.
      continue;
    }

    // 4. Anything that isn't a [number] marker is normal answer text.
    parts.push({ kind: "text", text: piece });
  }

  return parts;
}