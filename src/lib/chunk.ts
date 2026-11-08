export function chunkFixed(text: string, size: number): string[] {
  if (!text) {
    return []
  }

  const chunks = []
  let start = 0

  while (start < text.length) {
    chunks.push(text.slice(start, start + size))
    start = start + size
  }

  return chunks;
}

export function chunkWithOverlap(text: string, size: number, overlap: number): string[] {
  if (overlap >= size) {
throw new Error("overlap must be smaller than the chunk size");
  }
  if (!text) {
    return []
  }
  const chunks = []
  let start = 0
  while (start < text.length) {
    let end = start + size
    chunks.push(text.slice(start, end))
    if (end >= text.length) {
      break;
    }
    start = end - overlap
  }
  return chunks
}
