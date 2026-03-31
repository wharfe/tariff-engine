// src/classifier.ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { HsNode, ClassifyInput, ClassifyResult } from "./types.js";

let cachedTree: HsNode[] | null = null;

const DEFAULT_PATH = resolve(process.cwd(), "data/hs-tree.json");

export function loadTree(
  path?: string,
  options?: { force?: boolean },
): HsNode[] {
  if (cachedTree && !options?.force) return cachedTree;
  const filePath = path ?? DEFAULT_PATH;
  const raw = readFileSync(filePath, "utf-8");
  cachedTree = JSON.parse(raw) as HsNode[];
  return cachedTree;
}

export function classify(input: ClassifyInput): ClassifyResult {
  // Phase 1 implementation will be built incrementally
  // For now, return empty result to validate the pipeline
  return {
    candidates: [],
    needs_review: true,
  };
}
