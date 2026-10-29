import { embedTexts } from "../lib/embed";
import { cosineSimilarity } from "../lib/similarity";

const sentences = [
  "My dog loves long walks in the park.",
  "Puppies need a lot of sleep and play.",
  "Cats often nap in sunny spots.",
  "Your invoice is due at the end of the month.",
  "We accept card and bank transfer payments.",
  "Late payments may incur a small fee.",
];
const query = "What should I feed my puppy";

async function embedSentences(){
   // 1. Get all vectors in one call
   const vectors = await embedTexts([...sentences, query]);

   // 2. Separate query and sentence vectors using slice
   const queryVector = vectors[vectors.length - 1];
   const sentenceVectors = vectors.slice(0, -1);

   // 3. Map each sentence to an object containing its text and score
   const results = sentences.map((sentence, i) => ({
      text: sentence,
      score: cosineSimilarity(queryVector, sentenceVectors[i])
   }));

   // 4. Sort results from highest score to lowest
   results.sort((a, b) => b.score - a.score);

   // 5. Print each line neatly
   results.forEach(result => {
      console.log(`${result.score.toFixed(2)}\t${result.text}`);
   });
}

embedSentences();