import { answerQuestion, RetrievedChunk } from "../src/lib/answer";

// 1. Hardcoded mock data to test the prompt rules safely
const fakeChunks: RetrievedChunk[] = [
  {
    source: "fake.md",
    page: null,
    position: 0,
    similarity: 1,
    content: "Employees get 18 vacation days per year. Unused days roll over, up to 5 days.",
  },
  {
    source: "fake.md",
    page: null,
    position: 1,
    similarity: 1,
    content: "The office is closed on public holidays.",
  },
];

async function runDrill() {
  // 2. Test a question that IS in the text
  console.log("--- TEST 1 (Should answer correctly) ---");
  const answer1 = await answerQuestion("How many vacation days do I get?", fakeChunks);
  console.log(answer1);

  // 3. Test a question that IS NOT in the text (should trigger "I don't know")
  console.log("\n--- TEST 2 (Should say I don't know) ---");
  const answer2 = await answerQuestion("What is the capital of France?", fakeChunks);
  console.log(answer2);
}

runDrill().catch(console.error);