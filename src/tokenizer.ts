// src/tokenizer.ts

const STOP_WORDS = new Set([
  "a", "an", "the", "of", "for", "and", "or", "in", "on", "to",
  "with", "by", "is", "are", "was", "were", "be", "been", "being",
  "that", "this", "it", "its", "from", "as", "at", "not", "no",
]);

export function tokenize(description: string): string[] {
  return description
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 1 && !STOP_WORDS.has(word));
}
