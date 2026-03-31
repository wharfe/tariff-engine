// src/gir.ts

import type { Candidate } from "./types.js";

/**
 * GIR 3(a): Most specific description wins.
 * Primary sort by confidence descending.
 * Tie-break by matchedTokenCount (more matched tokens = more specific description).
 */
export function applyGir3a(candidates: Candidate[]): Candidate[] {
  return [...candidates].sort((a, b) => {
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    return b.matchedTokenCount - a.matchedTokenCount;
  });
}

/**
 * GIR 3(c): When 3(a) and 3(b) cannot resolve, take the last heading in numerical order.
 */
export function applyGir3c(candidates: Candidate[]): Candidate[] {
  if (candidates.length < 2) return candidates;
  const topConfidence = candidates[0].confidence;
  const topMatchCount = candidates[0].matchedTokenCount;
  const tied = candidates.filter(
    (c) => c.confidence === topConfidence && c.matchedTokenCount === topMatchCount,
  );
  if (tied.length <= 1) return candidates;
  tied.sort((a, b) => b.hscode.localeCompare(a.hscode));
  const rest = candidates.filter(
    (c) => !(c.confidence === topConfidence && c.matchedTokenCount === topMatchCount),
  );
  return [tied[0], ...rest];
}
