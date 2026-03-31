// src/scoring.ts
// Scoring functions for HS description matching.

import { tokenize } from "./tokenizer.js";
import { cachedStem, stemSet, stemMatchCount } from "./stemmer.js";
import { WEAKENING_ADJACENTS, expandTokensStrong, expandTokensAll } from "./lexicon.js";

export const SCORING = {
  // Cross-reference penalties
  CROSS_REF_ONLY_PENALTY: 0.1,
  CROSS_REF_MAJORITY_PENALTY: 0.4,
  // Weakening adjacent penalty
  WEAKENING_ADJACENT_PENALTY: 0.5,
  // Coverage blend weights
  COVERAGE_BASE_WEIGHT: 0.7,
  COVERAGE_DESC_WEIGHT: 0.15,
  COVERAGE_MATCH_WEIGHT: 0.15,
  // Synonym score weights
  STRONG_SYNONYM_WEIGHT: 0.95,
  WEAK_SYNONYM_WEIGHT: 0.75,
  // Deep match weights
  DEEP_CHILD_WEIGHT: 0.7,
  DEEP_GRANDCHILD_WEIGHT: 0.7,
  DEEP_BLEND_PARENT: 0.6,
  DEEP_BLEND_CHILD: 0.4,
  // Subheading penalties
  OTHER_THAN_BOOST: 1.05,
  FALLBACK_PENALTY: 0.3,
  NEGATION_PENALTY: 0.3,
  // Section scoring
  MATERIAL_SECTION_PENALTY: 0.3,
  FUNCTION_ROUTE_MIN_SCORE: 0.8,
  FUNCTION_ROUTE_MATERIAL_PENALTY: 0.4,
  // Chapter routing
  ROUTED_CHAPTER_MIN_SCORE: 0.6,
  PENALIZED_CHAPTER_FACTOR: 0.2,
  // Final confidence
  SECTION_WEIGHT: 0.1,
  CHAPTER_WEIGHT: 0.2,
  HEADING_WEIGHT: 0.4,
  SUBHEADING_WEIGHT: 0.3,
  NEEDS_REVIEW_THRESHOLD: 0.7,
} as const;

// Regex to detect incidental/cross-reference mentions of terms
export const CROSS_REF_RE = /\b(?:except|excluding|other than|of heading(?:\s+no\.?)?)\s/i;

// Cache tokenized descriptions to avoid re-tokenizing
const descTokenCache = new Map<string, string[]>();
export function cachedTokenize(description: string): string[] {
  let tokens = descTokenCache.get(description);
  if (!tokens) {
    tokens = tokenize(description);
    descTokenCache.set(description, tokens);
  }
  return tokens;
}

/**
 * Score how well a description matches input tokens, penalizing incidental mentions.
 * A "direct" description like "Rice" scores higher than one that says
 * "except rice of heading 1006".
 */
export function scoreDescription(inputTokens: string[], description: string): number {
  const descTokenList = cachedTokenize(description);
  const descTokens = new Set(descTokenList);
  const matched = stemMatchCount(inputTokens, descTokens);
  let score = inputTokens.length > 0 ? matched / inputTokens.length : 0;

  if (score > 0 && CROSS_REF_RE.test(description)) {
    // Check if the matched tokens appear mainly in cross-reference context
    const descLower = description.toLowerCase();
    const crossRefParts = descLower.split(/[;,]/).filter((part) =>
      CROSS_REF_RE.test(part),
    );
    const directParts = descLower.split(/[;,]/).filter(
      (part) => !CROSS_REF_RE.test(part),
    );

    const crossRefTokens = new Set(crossRefParts.flatMap((p) => tokenize(p)));
    const directTokens = new Set(directParts.flatMap((p) => tokenize(p)));

    // Count how many input tokens match only in cross-ref context vs direct
    let crossRefOnly = 0;
    let directMatch = 0;
    for (const t of inputTokens) {
      if (directTokens.has(t)) directMatch++;
      else if (crossRefTokens.has(t)) crossRefOnly++;
    }

    // If most matches are from cross-references, heavily penalize
    if (crossRefOnly > 0 && directMatch === 0) {
      score *= SCORING.CROSS_REF_ONLY_PENALTY;
    } else if (crossRefOnly > directMatch) {
      score *= SCORING.CROSS_REF_MAJORITY_PENALTY;
    }
  }

  // Penalize when input token matches a word that is modified by a weakening adjacent.
  if (score > 0) {
    const descWords = description.toLowerCase().split(/[\s;,()]+/);
    for (const t of inputTokens) {
      const weakeners = WEAKENING_ADJACENTS[t];
      if (!weakeners || !descTokens.has(t)) continue;
      const idx = descWords.indexOf(t);
      if (idx >= 0) {
        const nextWord = descWords[idx + 1] ?? "";
        const prevWord = descWords[idx - 1] ?? "";
        if (weakeners.includes(nextWord) || weakeners.includes(prevWord)) {
          score *= SCORING.WEAKENING_ADJACENT_PENALTY;
        }
      }
    }
  }

  // Bonus for high coverage of the description
  const descTokenCount = descTokenList.length;
  if (descTokenCount > 0 && matched > 0) {
    const inputStemSet = stemSet(inputTokens);
    const descCoverage = descTokenList.filter((t) => inputStemSet.has(t) || inputStemSet.has(cachedStem(t))).length / descTokenCount;
    score = score * SCORING.COVERAGE_BASE_WEIGHT + Math.min(descCoverage, 1.0) * SCORING.COVERAGE_DESC_WEIGHT + Math.min(matched / descTokenCount, 1.0) * SCORING.COVERAGE_MATCH_WEIGHT;
  }

  return score;
}

// Score a node description using original + synonym-expanded tokens
export function bestDescScore(inputTokens: string[], strongExpanded: string[], allExpanded: string[], description: string): number {
  let score = scoreDescription(inputTokens, description);
  // Strong synonyms (near-equivalents like chair→seat) at high weight
  const strongScore = scoreDescription(strongExpanded, description);
  if (strongScore > score) {
    score = Math.max(score, strongScore * SCORING.STRONG_SYNONYM_WEIGHT);
  }
  // All synonyms (including weak like salmon→fish) at lower weight
  const allScore = scoreDescription(allExpanded, description);
  if (allScore > score) {
    score = Math.max(score, allScore * SCORING.WEAK_SYNONYM_WEIGHT);
  }
  return score;
}

export const OTHER_THAN_RE = /other than ([^;,]+)/i;
export const FALLBACK_RE = /\bn\.e\.s\.i\b|\bn\.e\.c\b|\bnot elsewhere\b/i;

export function scoreSubheading(inputTokens: string[], node: { description: string; children: unknown[] }): number {
  const strongExpanded = expandTokensStrong(inputTokens);
  const allExpanded = expandTokensAll(inputTokens);
  let score = bestDescScore(inputTokens, strongExpanded, allExpanded, node.description);

  // "other than X" pattern
  const otherThanMatch = node.description.match(OTHER_THAN_RE);
  if (otherThanMatch) {
    const excludedTokens = tokenize(otherThanMatch[1]);
    const inputStemmed = stemSet(inputTokens);
    const hasExcluded = excludedTokens.some((t) => inputStemmed.has(t) || inputStemmed.has(cachedStem(t)));
    if (hasExcluded) return 0;
    // Input does NOT contain excluded terms → this IS the correct catch-all.
    score *= SCORING.OTHER_THAN_BOOST;
  }

  // Negation penalty: when description says "not X" and input contains X
  const descLower = node.description.toLowerCase();
  const notMatches = descLower.matchAll(/(?<!\bwhether\s)(?<!\bor\s)\bnot\s+(\w+)/g);
  for (const m of notMatches) {
    const negatedWord = m[1];
    if (negatedWord === "elsewhere" || negatedWord === "exceeding" ||
        negatedWord === "backed" || negatedWord === "chemically" ||
        negatedWord === "further" || negatedWord === "exceeding") continue;
    const negatedStem = cachedStem(negatedWord);
    for (const t of inputTokens) {
      if (t === negatedWord || cachedStem(t) === negatedStem || t === negatedStem) {
        score *= SCORING.NEGATION_PENALTY;
        break;
      }
    }
  }

  // Fallback penalty: n.e.s.i., n.e.c., or description starts with "Other"
  const isFallback =
    (FALLBACK_RE.test(node.description) ||
    node.description.startsWith("Other ")) &&
    !otherThanMatch;
  if (isFallback) {
    score *= SCORING.FALLBACK_PENALTY;
  }

  return score;
}
