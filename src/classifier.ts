// src/classifier.ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { HsNode, ClassifyInput, ClassifyResult } from "./types.js";
import { SECTION_MAP } from "./section-map.js";
import { tokenize } from "./tokenizer.js";

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

export interface ScoredSection {
  section: string;
  title: string;
  score: number;
  chapters: string[];
}

export function scoreSection(inputTokens: string[]): ScoredSection[] {
  if (inputTokens.length === 0) return [];

  const scored: ScoredSection[] = SECTION_MAP.map((entry) => {
    const keywordSet = new Set(entry.keywords);
    const matched = inputTokens.filter((t) => keywordSet.has(t)).length;
    const score = matched / inputTokens.length;
    return {
      section: entry.section,
      title: entry.title,
      score,
      chapters: entry.chapters,
    };
  });

  // Filter: >= 50% of max score, minimum 3
  const maxScore = Math.max(...scored.map((s) => s.score));
  const threshold = maxScore * 0.5;
  const filtered = scored
    .filter((s) => s.score >= threshold && s.score > 0)
    .sort((a, b) => b.score - a.score);

  if (filtered.length >= 3) return filtered;
  return scored.sort((a, b) => b.score - a.score).slice(0, 3);
}

export interface ScoredNode {
  node: HsNode;
  score: number;
}

export function scoreNodes(inputTokens: string[], nodes: HsNode[]): ScoredNode[] {
  if (inputTokens.length === 0 || nodes.length === 0) return [];

  const scored: ScoredNode[] = nodes.map((node) => {
    const descTokens = new Set(tokenize(node.description));
    const matched = inputTokens.filter((t) => descTokens.has(t)).length;
    const score = matched / inputTokens.length;
    return { node, score };
  });

  const maxScore = Math.max(...scored.map((s) => s.score));
  if (maxScore === 0) {
    return scored.sort((a, b) => b.score - a.score).slice(0, 3);
  }
  const threshold = maxScore * 0.5;
  const filtered = scored
    .filter((s) => s.score >= threshold && s.score > 0)
    .sort((a, b) => b.score - a.score);

  if (filtered.length >= 3) return filtered;
  return scored.sort((a, b) => b.score - a.score).slice(0, 3);
}

const OTHER_THAN_RE = /other than ([^;,]+)/i;
const FALLBACK_RE = /\bn\.e\.s\.i\b|\bn\.e\.c\b|\bnot elsewhere\b/i;
const FALLBACK_PENALTY = 0.3;

export function scoreSubheading(inputTokens: string[], node: HsNode): number {
  const descTokens = new Set(tokenize(node.description));
  const matched = inputTokens.filter((t) => descTokens.has(t)).length;
  let score = inputTokens.length > 0 ? matched / inputTokens.length : 0;

  // "other than X" pattern: if input contains X tokens, score = 0
  const otherThanMatch = node.description.match(OTHER_THAN_RE);
  if (otherThanMatch) {
    const excludedTokens = tokenize(otherThanMatch[1]);
    const inputSet = new Set(inputTokens);
    const hasExcluded = excludedTokens.some((t) => inputSet.has(t));
    if (hasExcluded) return 0;
  }

  // Fallback penalty: n.e.s.i., n.e.c., or description starts with "Other"
  const isFallback =
    FALLBACK_RE.test(node.description) ||
    node.description.startsWith("Other ");
  if (isFallback) {
    score *= FALLBACK_PENALTY;
  }

  return score;
}

export function classify(input: ClassifyInput): ClassifyResult {
  // Phase 1 implementation will be built incrementally
  // For now, return empty result to validate the pipeline
  return {
    candidates: [],
    needs_review: true,
  };
}
