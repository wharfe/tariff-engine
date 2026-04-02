// src/rule-types.ts
// Runtime types for chapter rule sets loaded from rules.json files.

import type { RuleCondition } from "./types.js";

export interface ExclusionParams {
  excludedCodes: string[];
  reason: string;
}

export interface DefinitionParams {
  term: string;
  meaning: string;
  appliesTo: string[];
}

export interface RoutingParams {
  target: string;
  conditions: RuleCondition[];
}

export interface PartsRuleParams {
  rule: "principal_use" | "stay_in_own_heading" | "not_parts";
  affectedCodes?: string[];
}

export interface ScopeParams {
  heading: string;
  covers: string;
  conditions: RuleCondition[];
}

export interface PreScoringRule {
  clauseType: "exclusion" | "routing";
  params: ExclusionParams | RoutingParams;
}

export interface ScoringRule {
  clauseType: "scope" | "definition";
  params: ScopeParams | DefinitionParams;
}

export interface PartsRule {
  clauseType: "parts_rule";
  params: PartsRuleParams;
}

export interface ChapterRuleSet {
  chapter: string;
  preScoringRules: PreScoringRule[];
  scoringRules: ScoringRule[];
  partsRules: PartsRule[];
}

export interface ScoringAdjustment {
  factor: number;
  reason: string;
}
