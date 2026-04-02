// src/rule-applier.ts
// Runtime rule applier: loads chapter rule sets and applies them during classification.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { evaluateCondition } from "./rule-engine.js";
import type { ClassifyInput, HsNode, Candidate } from "./types.js";
import type {
  ChapterRuleSet,
  PreScoringRule,
  ScoringRule,
  PartsRule,
  ScoringAdjustment,
  ExclusionParams,
  RoutingParams,
  DefinitionParams,
  ScopeParams,
  PartsRuleParams,
} from "./rule-types.js";

const rulesCache = new Map<string, ChapterRuleSet | null>();

const DEFAULT_RULES_DIR = resolve(process.cwd(), "data/rules");

/**
 * Load rules for a chapter from data/rules/chapter-{chapter}.json.
 * Returns null if the file does not exist. Caches the result.
 */
export function loadRules(chapter: string): ChapterRuleSet | null {
  if (rulesCache.has(chapter)) return rulesCache.get(chapter)!;

  try {
    const filePath = resolve(DEFAULT_RULES_DIR, `chapter-${chapter}.json`);
    const raw = readFileSync(filePath, "utf-8");
    const rules = JSON.parse(raw) as ChapterRuleSet;
    rulesCache.set(chapter, rules);
    return rules;
  } catch {
    rulesCache.set(chapter, null);
    return null;
  }
}

/**
 * Inject rules for a chapter directly (browser/test use).
 */
export function setRules(chapter: string, rules: ChapterRuleSet): void {
  rulesCache.set(chapter, rules);
}

/**
 * Clear all cached rules (for test cleanup).
 */
export function clearRules(): void {
  rulesCache.clear();
}

// --- Helper: check if input description matches all conditions ---
export function matchesConditions(
  conditions: { type: string; field: string; value: string | number }[],
  input: ClassifyInput,
): boolean {
  const { dimensions_cm: _, ...flatAttrs } = input.attributes ?? {};
  const attrs: Record<string, string | number | undefined> = {
    description: input.description.toLowerCase(),
    ...flatAttrs,
  };
  return conditions.every((cond) =>
    evaluateCondition(
      { type: cond.type as "contains", field: cond.field, value: cond.value },
      attrs,
    ),
  );
}

/**
 * Apply pre-scoring rules: exclusion (filter out) and routing (filter/force).
 * Returns filtered/modified candidate list.
 */
export function applyPreScoringRules(
  rules: PreScoringRule[],
  input: ClassifyInput,
  candidates: HsNode[],
): HsNode[] {
  let result = [...candidates];

  for (const rule of rules) {
    if (rule.clauseType === "exclusion") {
      const params = rule.params as ExclusionParams;
      // Exclusion: check if input matches rail/exclusion keywords
      const desc = input.description.toLowerCase();
      const isRailOnly =
        (desc.includes("railway") || desc.includes("tramway") || desc.includes("rail")) &&
        desc.includes("solely") &&
        !desc.includes("road");
      if (isRailOnly) {
        result = result.filter(
          (n) => !params.excludedCodes.some((code) => n.code.startsWith(code)),
        );
      }
    } else if (rule.clauseType === "routing") {
      const params = rule.params as RoutingParams;
      if (matchesConditions(params.conditions, input)) {
        // Routing: filter candidates based on target
        if (params.target.includes("-")) {
          // Range target like "8702-8704": remove codes outside range
          // that are specifically excluded by the routing rule
          const [start, end] = params.target.split("-").map((s) => parseInt(s, 10));
          result = result.filter((n) => {
            const code = parseInt(n.code, 10);
            // Keep if within the target range
            if (code >= start && code <= end) return true;
            // Exclude headings in the same chapter that are above the range
            // (e.g., chassis+cab routes to 8702-8704, not 8706)
            if (n.code.startsWith("87") && code > end) return false;
            return true;
          });
        }
        // Single target like "8712": no filtering needed, just ensure presence
      }
    }
  }

  return result;
}

/**
 * Apply scoring adjustments: definition (boost) and scope (narrow).
 * Returns array of factor+reason adjustments.
 */
export function applyScoringAdjustments(
  rules: ScoringRule[],
  input: ClassifyInput,
  candidate: Candidate,
): ScoringAdjustment[] {
  const adjustments: ScoringAdjustment[] = [];
  const desc = input.description.toLowerCase();

  for (const rule of rules) {
    if (rule.clauseType === "definition") {
      const params = rule.params as DefinitionParams;
      const termLower = params.term.toLowerCase();
      // Match singular/plural: strip trailing 's' for comparison
      const termBase = termLower.replace(/s$/, "");
      // Check if the input description contains the defined term
      if (desc.includes(termLower) || desc.includes(termBase)) {
        // Check if the candidate heading matches one of the appliesTo codes
        // Strip "Chapter " / "Section " prefixes from appliesTo values
        const matchesHeading = params.appliesTo.some((code) => {
          const normalized = code.replace(/^(Chapter|Section)\s+/i, "");
          return candidate.hscode.startsWith(normalized);
        });
        if (matchesHeading) {
          // Boost: input uses the defined term and candidate is the correct heading
          adjustments.push({
            factor: 1.15,
            reason: `Definition: "${params.term}" matches heading ${params.appliesTo.join(", ")} — ${params.meaning}`,
          });
        }
      }
    } else if (rule.clauseType === "scope") {
      const params = rule.params as ScopeParams;
      // Check if candidate matches the scoped heading
      if (candidate.hscode.startsWith(params.heading) || candidate.hscode === params.heading) {
        // Check if input matches scope conditions
        if (matchesConditions(params.conditions, input)) {
          adjustments.push({
            factor: 1.1,
            reason: `Scope: ${params.heading} covers ${params.covers}`,
          });
        } else {
          adjustments.push({
            factor: 0.8,
            reason: `Scope: ${params.heading} requires conditions not met in input`,
          });
        }
      }
    }
  }

  // If no adjustments, return neutral
  if (adjustments.length === 0) {
    adjustments.push({ factor: 1.0, reason: "No rule adjustments" });
  }

  return adjustments;
}

/**
 * Apply parts rules: detect if input is about parts and determine handling.
 * Returns null if no parts rules are relevant.
 */
export function applyPartsRules(
  rules: PartsRule[],
  input: ClassifyInput,
): { isPart: boolean; principalUseHeading?: string } | null {
  const desc = input.description.toLowerCase();

  // Simple parts detection heuristic
  const partsKeywords = ["parts", "part", "accessories", "accessory", "component", "components"];
  const isPart = partsKeywords.some((kw) => desc.includes(kw));

  if (!isPart) return null;

  for (const rule of rules) {
    const params = rule.params as PartsRuleParams;
    if (params.rule === "principal_use") {
      return { isPart: true };
    }
    if (params.rule === "stay_in_own_heading") {
      return { isPart: true };
    }
  }

  return { isPart: true };
}
