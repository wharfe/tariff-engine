// compiler/types.ts
// Compiler-internal types for the notes-to-rules pipeline.

import type { RuleCondition } from "../src/types.js";

// Layer 1 output: parsed clause from structured notes markdown
export interface NoteClause {
  source: "section" | "chapter" | "subheading";
  noteNumber: number;
  subItem?: string;   // "(a)", "(b)", etc.
  text: string;       // Original text of the clause
}

// Layer 2 output: classified clause with type and extracted parameters
export type ClauseType = "exclusion" | "definition" | "routing" | "parts_rule" | "scope";

export interface ClassifiedClause extends NoteClause {
  clauseType: ClauseType;
  params: ExclusionParams | DefinitionParams | RoutingParams | PartsRuleParams | ScopeParams;
}

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
