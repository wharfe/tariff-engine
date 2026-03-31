// src/classifier.ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { HsNode, ClassifyInput, ClassifyResult, Candidate } from "./types.js";
import { SECTION_MAP } from "./section-map.js";
import { tokenize } from "./tokenizer.js";
import { applyGir3a, applyGir3c } from "./gir.js";

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

const NEEDS_REVIEW_THRESHOLD = 0.7;
const WEIGHTS = { section: 0.1, chapter: 0.2, heading: 0.4, subheading: 0.3 };

export function classify(input: ClassifyInput): ClassifyResult {
  const tree = cachedTree;
  if (!tree) {
    throw new Error("Tree not loaded. Call loadTree() first.");
  }

  const tokens = tokenize(input.description);
  if (tokens.length === 0) {
    return { candidates: [], needs_review: true };
  }

  // Step 1: Score sections
  const sections = scoreSection(tokens);
  if (sections.length === 0) {
    return { candidates: [], needs_review: true };
  }

  // Step 2: Get candidate chapters from matched sections
  const sectionChapterCodes = new Set(sections.flatMap((s) => s.chapters));
  const candidateChapters = tree.filter((ch) => sectionChapterCodes.has(ch.code));
  const chapterScores = scoreNodes(tokens, candidateChapters);

  // Step 3: For each candidate chapter, score headings, then subheadings
  const allCandidates: Candidate[] = [];

  for (const { node: chapter, score: chScore } of chapterScores) {
    const sectionEntry = sections.find((s) => s.chapters.includes(chapter.code));
    const sScore = sectionEntry?.score ?? 0;

    const headingScores = scoreNodes(tokens, chapter.children);

    for (const { node: heading, score: hScore } of headingScores) {
      if (heading.children.length === 0) {
        // Heading with no subheadings
        const descTokens = new Set(tokenize(heading.description));
        const matchedCount = tokens.filter((t) => descTokens.has(t)).length;
        const confidence =
          WEIGHTS.section * sScore +
          WEIGHTS.chapter * chScore +
          WEIGHTS.heading * hScore +
          WEIGHTS.subheading * hScore;

        allCandidates.push({
          hscode: heading.code,
          description: heading.description,
          confidence,
          matchedTokenCount: matchedCount,
          reasoning: [
            `Section ${sectionEntry?.section ?? "?"}: ${sectionEntry?.title ?? ""}`,
            `Chapter ${chapter.code}: ${chapter.description}`,
            `Heading ${heading.code}: ${heading.description}`,
          ],
        });
        continue;
      }

      for (const sub of heading.children) {
        const subScore = scoreSubheading(tokens, sub);
        const descTokens = new Set(tokenize(sub.description));
        const matchedCount = tokens.filter((t) => descTokens.has(t)).length;

        const confidence =
          WEIGHTS.section * sScore +
          WEIGHTS.chapter * chScore +
          WEIGHTS.heading * hScore +
          WEIGHTS.subheading * subScore;

        allCandidates.push({
          hscode: sub.code,
          description: sub.description,
          confidence,
          matchedTokenCount: matchedCount,
          reasoning: [
            `Section ${sectionEntry?.section ?? "?"}: ${sectionEntry?.title ?? ""}`,
            `Chapter ${chapter.code}: ${chapter.description}`,
            `Heading ${heading.code}: ${heading.description}`,
            `Subheading ${sub.code}: ${sub.description}`,
          ],
        });
      }
    }
  }

  // Step 4: GIR resolution and ranking
  let ranked = applyGir3a(allCandidates);
  ranked = applyGir3c(ranked);

  const top3 = ranked.slice(0, 3);
  const topConfidence = top3[0]?.confidence ?? 0;
  const needs_review = topConfidence < NEEDS_REVIEW_THRESHOLD;

  return { candidates: top3, needs_review };
}
