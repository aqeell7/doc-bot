import { pickCacheHit, type CacheCandidate } from "../src/lib/cache-check";

const make = (id: number, similarity: number): CacheCandidate => ({
  id, question: `q${id}`, answer: `answer ${id}`, sources: "[]", similarity,
});
const T = 0.9;

console.log("1", pickCacheHit([], T));
console.log("2", pickCacheHit([make(1, 0.95)], T)?.id);
console.log("3", pickCacheHit([make(1, 0.8)], T));
console.log("4", pickCacheHit([make(1, 0.91), make(2, 0.97)], T)?.id);
console.log("5", pickCacheHit([make(1, 0.9)], T)?.id);
console.log("6", pickCacheHit([make(1, NaN)], T));