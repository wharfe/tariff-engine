// src/gir.ts

import type { Candidate } from "./types.js";

/**
 * GIR 3(a): Most specific description wins.
 * Among equally matched candidates, prefer the one with more matching conditions.
 */
export function applyGir3a(candidates: Candidate[]): Candidate[] {
  return candidates.sort((a, b) => b.confidence - a.confidence);
}

/**
 * GIR 3(c): When 3(a) and 3(b) cannot resolve, take the last heading in numerical order.
 */
export function applyGir3c(candidates: Candidate[]): Candidate[] {
  if (candidates.length < 2) return candidates;
  const topConfidence = candidates[0].confidence;
  const tied = candidates.filter((c) => c.confidence === topConfidence);
  if (tied.length <= 1) return candidates;
  tied.sort((a, b) => b.hscode.localeCompare(a.hscode));
  return [tied[0], ...candidates.filter((c) => c.confidence !== topConfidence)];
}
