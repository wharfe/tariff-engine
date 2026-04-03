// src/classifier.ts
// Orchestration layer: loads HS tree and classifies product descriptions.

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import type { HsNode, ClassifyInput, ClassifyResult, Candidate } from "./types.js";
import { SECTION_MAP } from "./section-map.js";
import { tokenize } from "./tokenizer.js";
import { applyGir3a, applyGir3c } from "./gir.js";
import { cachedStem, stemSet, stemMatchCount } from "./stemmer.js";
import {
  FUNCTION_WORDS, MATERIAL_TOKENS, MATERIAL_SECTIONS,
  FUNCTION_CHAPTERS, expandTokensStrong, expandTokensAll,
} from "./lexicon.js";
import { FUNCTION_SECTION_ROUTES, PRODUCT_CHAPTER_ROUTES } from "./routes.js";
import { SCORING, bestDescScore, scoreSubheading } from "./scoring.js";
import { loadRules as loadChapterRules, applyPreScoringRules, applyScoringAdjustments, matchesConditions } from "./rule-applier.js";
import type { ChapterRuleSet, RoutingParams } from "./rule-types.js";

let cachedTree: HsNode[] | null = null;

const DEFAULT_PATH = resolve(process.cwd(), "data/hs-tree.json");

// Heading-level synonym table: heading code → Set of everyday product words
let headingSynonyms: Map<string, Set<string>> | null = null;

function loadHeadingSynonyms(): void {
  if (headingSynonyms) return;
  try {
    const filePath = resolve(process.cwd(), "data/heading-synonyms.json");
    if (!existsSync(filePath)) {
      headingSynonyms = new Map();
      return;
    }
    const raw = JSON.parse(readFileSync(filePath, "utf-8")) as Record<string, string[]>;
    headingSynonyms = new Map();
    for (const [code, words] of Object.entries(raw)) {
      headingSynonyms.set(code, new Set(words));
    }
  } catch {
    headingSynonyms = new Map();
  }
}

export function setHeadingSynonyms(synonyms: Record<string, string[]>): void {
  headingSynonyms = new Map();
  for (const [code, words] of Object.entries(synonyms)) {
    headingSynonyms.set(code, new Set(words));
  }
}

export function loadTree(
  path?: string,
  options?: { force?: boolean },
): HsNode[] {
  if (cachedTree && !options?.force) return cachedTree;
  const filePath = path ?? DEFAULT_PATH;
  const raw = readFileSync(filePath, "utf-8");
  cachedTree = JSON.parse(raw) as HsNode[];
  loadHeadingSynonyms();
  return cachedTree;
}

// Inject a pre-loaded tree directly, bypassing fs.
// Useful in browser environments where readFileSync is unavailable.
export function setTree(tree: HsNode[]): void {
  cachedTree = tree;
}

export interface ScoredSection {
  section: string;
  title: string;
  score: number;
  chapters: string[];
}

export function scoreSection(inputTokens: string[]): ScoredSection[] {
  if (inputTokens.length === 0) return [];

  const hasFunctionWord = inputTokens.some((t) => FUNCTION_WORDS.has(t));

  // Determine function-based section routing (collect ALL routed sections).
  // Context modifiers (car, bicycle, etc.) are deprioritized when product words are present.
  const SECTION_CONTEXT_MODIFIERS = new Set([
    "electric", "electronic", "industrial", "household", "commercial",
    "baby", "children",
  ]);
  const functionRouteSections = new Set<string>();
  const hasProductSectionRoute = inputTokens.some(
    (t) => !SECTION_CONTEXT_MODIFIERS.has(t) && FUNCTION_SECTION_ROUTES[t],
  );
  for (const t of inputTokens) {
    const route = FUNCTION_SECTION_ROUTES[t];
    if (!route) continue;
    // Skip context modifier routes when product routes exist
    if (hasProductSectionRoute && SECTION_CONTEXT_MODIFIERS.has(t)) continue;
    functionRouteSections.add(route);
  }
  // Legacy: pick one for backward-compatible penalty logic
  const functionRouteSection = functionRouteSections.size > 0
    ? functionRouteSections.values().next().value as string
    : null;

  const scored: ScoredSection[] = SECTION_MAP.map((entry) => {
    const keywordSet = new Set(entry.keywords);
    const keywordStemSet = stemSet(entry.keywords);
    let matched = 0;
    for (const t of inputTokens) {
      if (keywordSet.has(t) || keywordStemSet.has(t) || keywordStemSet.has(cachedStem(t))) {
        matched++;
      }
    }
    let score = matched / inputTokens.length;

    // When a function word is present, penalize material sections
    if (hasFunctionWord && MATERIAL_SECTIONS.has(entry.section)) {
      score *= SCORING.MATERIAL_SECTION_PENALTY;
    }

    // Boost ALL function-routed sections
    if (functionRouteSections.has(entry.section)) {
      score = Math.max(score, SCORING.FUNCTION_ROUTE_MIN_SCORE);
    }

    // Penalize material-based sections when function routing is active,
    // but NOT if that section is itself a routed target
    if (functionRouteSections.size > 0 && !functionRouteSections.has(entry.section)) {
      const materialPenaltySections = new Set(["VII", "VIII", "IX", "XI", "XIII", "XIV", "XV"]);
      if (materialPenaltySections.has(entry.section)) {
        score *= SCORING.FUNCTION_ROUTE_MATERIAL_PENALTY;
      }
    }

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

  const strongExpanded = expandTokensStrong(inputTokens);
  const allExpanded = expandTokensAll(inputTokens);

  const inputTokenSet = new Set(inputTokens);

  const scored: ScoredNode[] = nodes.map((node) => {
    let score = bestDescScore(inputTokens, strongExpanded, allExpanded, node.description);

    // Heading synonym boost: if input tokens match LLM-generated everyday words
    // for this heading, boost the score even if the HS description doesn't match directly
    if (headingSynonyms && headingSynonyms.size > 0) {
      const synonyms = headingSynonyms.get(node.code);
      if (synonyms) {
        let synonymHits = 0;
        for (const t of inputTokens) {
          if (synonyms.has(t)) synonymHits++;
        }
        if (synonymHits > 0) {
          const synonymScore = synonymHits / inputTokens.length;
          // Blend: synonym match can bring a zero-score heading into contention,
          // or boost an already-matching heading
          if (score === 0) {
            score = synonymScore * 0.8;
          } else {
            score = Math.max(score, score * 0.5 + synonymScore * 0.5);
          }
        }
      }
    }

    // Deep match: check children descriptions for additional matches
    if (node.children.length > 0) {
      let bestChildScore = 0;
      for (const child of node.children) {
        const childScore = bestDescScore(inputTokens, strongExpanded, allExpanded, child.description);
        if (childScore > bestChildScore) bestChildScore = childScore;

        // Also check grandchildren (2-level deep match)
        for (const grandchild of child.children) {
          const gcScore = bestDescScore(inputTokens, strongExpanded, allExpanded, grandchild.description);
          const gcAdjusted = gcScore * SCORING.DEEP_GRANDCHILD_WEIGHT;
          if (gcAdjusted > bestChildScore) bestChildScore = gcAdjusted;
        }
      }
      // Use child score to supplement parent score
      if (score === 0) {
        score = bestChildScore * SCORING.DEEP_CHILD_WEIGHT;
      } else if (bestChildScore > score) {
        score = score * SCORING.DEEP_BLEND_PARENT + bestChildScore * SCORING.DEEP_BLEND_CHILD;
      }
    }

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

export { scoreSubheading } from "./scoring.js";

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

  // Add product-routed chapters to candidate set.
  // Context modifiers (car, bicycle, electric, etc.) describe usage context,
  // not the product itself. When a specific product word is also present,
  // suppress the context modifier's chapter route.
  // Context modifiers: words that describe usage context rather than the product.
  // Vehicle words (car, sedan) are NOT included — they are often the product itself.
  // Only include words that are almost always modifiers, not primary products.
  const CONTEXT_MODIFIERS = new Set([
    "electric", "electronic", "industrial", "household", "commercial",
    "baby", "children",
  ]);
  const routedChapterCodes = new Set<string>();
  const tokenRoutes = new Map<string, string[]>(); // token → chapters
  for (const t of tokens) {
    const routes = PRODUCT_CHAPTER_ROUTES[t];
    if (routes) tokenRoutes.set(t, routes);
  }

  // Check if we have both context modifiers and product words routing to different chapters
  const hasContextRoute = tokens.some((t) => CONTEXT_MODIFIERS.has(t) && tokenRoutes.has(t));
  const hasProductRoute = tokens.some((t) => !CONTEXT_MODIFIERS.has(t) && !MATERIAL_TOKENS.has(t) && tokenRoutes.has(t));

  for (const [t, routes] of tokenRoutes) {
    // Suppress context modifier routes when a product word routes elsewhere
    if (hasProductRoute && CONTEXT_MODIFIERS.has(t)) continue;
    for (const ch of routes) {
      sectionChapterCodes.add(ch);
      routedChapterCodes.add(ch);
    }
  }

  const candidateChapters = tree.filter((ch) => sectionChapterCodes.has(ch.code));

  // Apply pre-scoring rules for chapters that have rules
  let filteredCandidateChapters = candidateChapters;
  const chapterRulesMap = new Map<string, ChapterRuleSet>();
  for (const ch of candidateChapters) {
    const rules = loadChapterRules(ch.code);
    if (rules) {
      chapterRulesMap.set(ch.code, rules);
      filteredCandidateChapters = applyPreScoringRules(
        rules.preScoringRules,
        input,
        filteredCandidateChapters,
      );
    }
  }

  let chapterScores = scoreNodes(tokens, filteredCandidateChapters);

  // Boost routed chapters and demote non-routed when function routing is active
  if (routedChapterCodes.size > 0) {
    const penalizedSections = new Set<string>();
    const functionRouteSection = tokens.reduce<string | null>((acc, t) => FUNCTION_SECTION_ROUTES[t] ?? acc, null);
    if (functionRouteSection) {
      for (const entry of SECTION_MAP) {
        if (entry.section !== functionRouteSection) {
          const materialPenaltySections = new Set(["VII", "VIII", "IX", "XI", "XIII", "XIV", "XV"]);
          if (materialPenaltySections.has(entry.section)) {
            for (const ch of entry.chapters) penalizedSections.add(ch);
          }
        }
      }
    }

    // When multiple chapters are routed, preserve natural score ordering:
    // boost all routed chapters to min score, but add natural score as tiebreaker
    chapterScores = chapterScores.map((cs) => {
      if (routedChapterCodes.has(cs.node.code)) {
        return { node: cs.node, score: Math.max(cs.score, SCORING.ROUTED_CHAPTER_MIN_SCORE) + cs.score * 0.1 };
      }
      if (penalizedSections.has(cs.node.code)) {
        return { node: cs.node, score: cs.score * SCORING.PENALIZED_CHAPTER_FACTOR };
      }
      return cs;
    });
    chapterScores.sort((a, b) => b.score - a.score);
  }

  // Garment-word heuristic: when garment keywords are present in Section XI,
  // penalize raw textile chapters (50-60) in favor of garment chapters (61-63)
  const GARMENT_WORDS = new Set([
    "shirt", "dress", "trouser", "trousers", "jacket", "coat", "jeans",
    "cardigan", "socks", "shorts", "blouse", "skirt", "necktie", "tie",
    "tracksuit", "romper", "raincoat", "towel", "garment", "clothing",
    "t-shirt", "knitted", "knit", "woven", "crocheted",
  ]);
  const RAW_TEXTILE_CHAPTERS = new Set(["50", "51", "52", "53", "54", "55", "56", "57", "58", "59", "60"]);
  const hasGarmentWord = tokens.some((t) => GARMENT_WORDS.has(t));
  if (hasGarmentWord) {
    const hasWoven = tokens.includes("woven");
    const hasKnitted = tokens.some((t) => t === "knitted" || t === "knit" || t === "crocheted");
    chapterScores = chapterScores.map((cs) => {
      // Heavily suppress raw textile chapters when garment words are present
      if (RAW_TEXTILE_CHAPTERS.has(cs.node.code)) {
        return { node: cs.node, score: cs.score * 0.05 };
      }
      // Boost Ch.62 when "woven" is present, penalize Ch.61
      if (hasWoven && cs.node.code === "62") {
        return { node: cs.node, score: Math.max(cs.score, 0.7) };
      }
      if (hasWoven && !hasKnitted && cs.node.code === "61") {
        return { node: cs.node, score: cs.score * 0.5 };
      }
      // Boost Ch.61 when "knitted"/"knit" is present, penalize Ch.62
      if (hasKnitted && cs.node.code === "61") {
        return { node: cs.node, score: Math.max(cs.score, 0.7) };
      }
      if (hasKnitted && !hasWoven && cs.node.code === "62") {
        return { node: cs.node, score: cs.score * 0.5 };
      }
      return cs;
    });
    chapterScores.sort((a, b) => b.score - a.score);
  }

  // Step 3: For each candidate chapter, score headings, then subheadings
  const allCandidates: Candidate[] = [];

  for (const { node: chapter, score: chScore } of chapterScores) {
    const sectionEntry = sections.find((s) => s.chapters.includes(chapter.code));
    const sScore = sectionEntry?.score ?? 0;

    // For function-classified chapters, use function tokens for heading selection
    const isFunction = FUNCTION_CHAPTERS.has(chapter.code);
    let headingScores: { node: HsNode; score: number }[];
    if (isFunction) {
      const functionTokens = tokens.filter((t) => !MATERIAL_TOKENS.has(t));
      const effectiveTokens = functionTokens.length > 0 ? functionTokens : tokens;
      const withSynonyms = expandTokensStrong(effectiveTokens);
      headingScores = scoreNodes(withSynonyms, chapter.children);
    } else {
      headingScores = scoreNodes(tokens, chapter.children);
    }

    // Apply heading-level routing from chapter rules
    const chRules = chapterRulesMap.get(chapter.code);
    if (chRules) {
      for (const rule of chRules.preScoringRules) {
        if (rule.clauseType === "routing") {
          const params = rule.params as RoutingParams;
          if (matchesConditions(params.conditions, input)) {
            const target = params.target;
            if (target.includes("-")) {
              const [start, end] = target.split("-");
              // Penalize headings outside the target range
              headingScores = headingScores.map((hs) => {
                const code = hs.node.code;
                if (code >= start && code <= end) return hs;
                // Heavy penalization for headings outside routing range
                return { node: hs.node, score: hs.score * 0.1 };
              });
            } else {
              // Single target: boost matching heading
              headingScores = headingScores.map((hs) => {
                if (hs.node.code.startsWith(target)) {
                  return { node: hs.node, score: Math.max(hs.score, 0.8) };
                }
                return hs;
              });
            }
            headingScores.sort((a, b) => b.score - a.score);
          }
        }
      }
    }

    for (const { node: heading, score: hScore } of headingScores) {
      if (heading.children.length === 0) {
        const descTokens = new Set(tokenize(heading.description));
        const matchedCount = stemMatchCount(tokens, descTokens);
        const confidence =
          SCORING.SECTION_WEIGHT * sScore +
          SCORING.CHAPTER_WEIGHT * chScore +
          SCORING.HEADING_WEIGHT * hScore +
          SCORING.SUBHEADING_WEIGHT * hScore;

        let adjustedConfidence = confidence;
        const extraReasoning: string[] = [];
        const chRules = chapterRulesMap.get(chapter.code);
        if (chRules && chRules.scoringRules.length > 0) {
          const tempCandidate = {
            hscode: heading.code,
            description: heading.description,
            confidence,
            reasoning: [] as string[],
            matchedTokenCount: matchedCount,
          };
          const adjustments = applyScoringAdjustments(chRules.scoringRules, input, tempCandidate);
          const totalFactor = adjustments.reduce((acc, a) => acc * a.factor, 1.0);
          adjustedConfidence = confidence * totalFactor;
          for (const a of adjustments) {
            if (a.factor !== 1.0) {
              extraReasoning.push(a.reason);
            }
          }
        }

        allCandidates.push({
          hscode: heading.code,
          description: heading.description,
          confidence: adjustedConfidence,
          matchedTokenCount: matchedCount,
          reasoning: [
            `Section ${sectionEntry?.section ?? "?"}: ${sectionEntry?.title ?? ""}`,
            `Chapter ${chapter.code}: ${chapter.description}`,
            `Heading ${heading.code}: ${heading.description}`,
            ...extraReasoning,
          ],
        });
        continue;
      }

      for (const sub of heading.children) {
        const subScore = scoreSubheading(tokens, sub);
        const descTokens = new Set(tokenize(sub.description));
        const matchedCount = stemMatchCount(tokens, descTokens);

        const confidence =
          SCORING.SECTION_WEIGHT * sScore +
          SCORING.CHAPTER_WEIGHT * chScore +
          SCORING.HEADING_WEIGHT * hScore +
          SCORING.SUBHEADING_WEIGHT * subScore;

        let adjustedConfidence = confidence;
        const extraReasoning: string[] = [];
        const chRules = chapterRulesMap.get(chapter.code);
        if (chRules && chRules.scoringRules.length > 0) {
          const tempCandidate = {
            hscode: sub.code,
            description: sub.description,
            confidence,
            reasoning: [] as string[],
            matchedTokenCount: matchedCount,
          };
          const adjustments = applyScoringAdjustments(chRules.scoringRules, input, tempCandidate);
          const totalFactor = adjustments.reduce((acc, a) => acc * a.factor, 1.0);
          adjustedConfidence = confidence * totalFactor;
          for (const a of adjustments) {
            if (a.factor !== 1.0) {
              extraReasoning.push(a.reason);
            }
          }
        }

        allCandidates.push({
          hscode: sub.code,
          description: sub.description,
          confidence: adjustedConfidence,
          matchedTokenCount: matchedCount,
          reasoning: [
            `Section ${sectionEntry?.section ?? "?"}: ${sectionEntry?.title ?? ""}`,
            `Chapter ${chapter.code}: ${chapter.description}`,
            `Heading ${heading.code}: ${heading.description}`,
            `Subheading ${sub.code}: ${sub.description}`,
            ...extraReasoning,
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
  const needs_review = topConfidence < SCORING.NEEDS_REVIEW_THRESHOLD;

  return { candidates: top3, needs_review };
}
