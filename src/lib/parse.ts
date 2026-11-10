import { readFileSync } from "node:fs";
import { extractText, getDocumentProxy } from "unpdf";

// One piece of a file: its page number (null for markdown) and its text.
export type Page = { page: number | null; text: string };

export async function parseFile(path: string): Promise<Page[]> {
  // Markdown = already text, one "page", no page number.
  if (path.endsWith(".md")) {
    return [{ page: null, text: readFileSync(path, "utf-8") }];
  }

  // PDF = read the raw bytes, then ask unpdf for the text of EACH page.
  if (path.endsWith(".pdf")) {
    const buffer = readFileSync(path);
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractText(pdf, { mergePages: false }); // string[], one per page
    return text.map((pageText, i) => ({ page: i + 1, text: pageText })); // pages start at 1
  }

  throw new Error("Unsupported file type: " + path);
}