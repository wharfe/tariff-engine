// src/types.ts

export interface ClassifyInput {
  description: string;
  attributes?: {
    material?: string;
    weight_kg?: number;
    dimensions_cm?: { l: number; w: number; h: number };
    use?: string;
  };
}

export interface Candidate {
  hscode: string;
  description: string;
  confidence: number;
  reasoning: string[];
}

export interface ClassifyResult {
  candidates: Candidate[];
  needs_review: boolean;
}

export interface HsNode {
  code: string;
  description: string;
  level: number;
  parent?: string;
  children: HsNode[];
}

export interface RuleCondition {
  type: "equals" | "contains" | "gt" | "lt" | "gte" | "lte" | "not_contains";
  field: string;
  value: string | number;
}

export interface HeadingRule {
  description: string;
  exclusions: string[];
  subheadings: Record<
    string,
    {
      description: string;
      conditions: RuleCondition[];
    }
  >;
}

export interface ChapterRules {
  chapter: string;
  notes: {
    type: "exclusion" | "inclusion" | "definition";
    condition: string;
    action: string;
  }[];
  headings: Record<string, HeadingRule>;
}
