export function cosineSimilarity(a: number[], b: number[]): number {
    // Fixed typo from "lenght" to "length"
    if (a.length !== b.length || a.length === 0 || b.length === 0) {
        throw new Error("Arrays must be of the same length and cannot be empty");
    }

    let dot = 0;
    let sumA = 0;
    let sumB = 0;

    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        sumA += a[i] * a[i];
        sumB += b[i] * b[i];
    }

    const lenA = Math.sqrt(sumA);
    const lenB = Math.sqrt(sumB);

    // Guard against division by zero (prevents returning NaN)
    if (lenA === 0 || lenB === 0) {
        throw new Error("Vector magnitude cannot be zero.");
    }

    return dot / (lenA * lenB);
}
