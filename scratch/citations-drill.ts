import { parseCitations, AnswerPart } from "../src/lib/citations";

function show(title: string, parts: AnswerPart[]) {
  const line = parts
    .map((p) => (p.kind === "text" ? JSON.stringify(p.text) : p.valid ? `[${p.n}✓]` : `[${p.n}✗]`))
    .join(" ");
  console.log(`${title}\n  ${line || "(empty)"}`);
}

show("Test 1 normal answer:", parseCitations("Refund within 14 days [1]. Team rules differ [2].", 5));
show("Test 2 glued + out-of-range:", parseCitations("Both apply [1][3] and also [6]", 5));
show("Test 3 comma list:", parseCitations("See [1], [4]", 5));
show("Test 4 no citations:", parseCitations("No citations here", 5));
show("Test 5 empty answer:", parseCitations("", 5));
show("Test 6 not a citation:", parseCitations("Costs [about] $6 or [ 2 ]", 5));