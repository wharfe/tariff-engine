// compiler/rule-generator.ts
// Layer 3: Convert classified clauses into a ChapterRuleSet for runtime use.

import type { ClassifiedClause } from "./types.js";
import type {
  ChapterRuleSet,
  PreScoringRule,
  ScoringRule,
  PartsRule,
} from "../src/rule-types.js";

/**
 * Generate a ChapterRuleSet from classified clauses.
 * Strips NoteClause metadata (source, noteNumber, text) and sorts
 * clauses into the appropriate rule category.
 */
export function generateRules(clauses: ClassifiedClause[], chapter: string): ChapterRuleSet {
  const preScoringRules: PreScoringRule[] = [];
  const scoringRules: ScoringRule[] = [];
  const partsRules: PartsRule[] = [];

  for (const clause of clauses) {
    switch (clause.clauseType) {
      case "exclusion":
        preScoringRules.push({
          clauseType: "exclusion",
          params: clause.params,
        } as PreScoringRule);
        break;
      case "routing":
        preScoringRules.push({
          clauseType: "routing",
          params: clause.params,
        } as PreScoringRule);
        break;
      case "definition":
        scoringRules.push({
          clauseType: "definition",
          params: clause.params,
        } as ScoringRule);
        break;
      case "scope":
        scoringRules.push({
          clauseType: "scope",
          params: clause.params,
        } as ScoringRule);
        break;
      case "parts_rule":
        partsRules.push({
          clauseType: "parts_rule",
          params: clause.params,
        } as PartsRule);
        break;
    }
  }

  return {
    chapter,
    preScoringRules,
    scoringRules,
    partsRules,
  };
}
