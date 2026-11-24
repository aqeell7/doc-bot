// The threshold check for the semantic cache. No imports: safe to test by hand.

export type CacheCandidate = {
  id: number;
  question: string;   // the old question that was saved
  answer: string;     // the old answer
  sources: string;    // the old sources list, as JSON text
  similarity: number; // how close it is to the NEW question (0–1)
};

export function pickCacheHit(candidates: CacheCandidate[], threshold: number): CacheCandidate | null {
  //if the list is empty, return null (a miss).
  if(candidates.length === 0) return null;
  // make a variable `best` that starts as the first candidate.
  let best = candidates[0]
  
  // loop over every candidate; if one has a higher similarity than `best`, it becomes `best`.
  //          (Don't trust that the list is already sorted.)
  for (const c of candidates) {
    if(c.similarity >= best.similarity){
        best = c
    }
  }

  // if best's similarity is at least the threshold (>=), return best (a hit).
  if(best.similarity >= threshold) return best
  // otherwise return null (a miss).
  return null
}