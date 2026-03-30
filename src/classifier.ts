// src/classifier.ts

import type { ClassifyInput, ClassifyResult } from "./types.js";

export function classify(input: ClassifyInput): ClassifyResult {
  // Phase 1 implementation will be built incrementally
  // For now, return empty result to validate the pipeline
  return {
    candidates: [],
    needs_review: true,
  };
}
