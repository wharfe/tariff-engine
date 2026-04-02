// tests/types.test.ts
import { describe, it, expect } from "vitest";
import type {
  PreScoringRule,
  ScoringRule,
  PartsRule,
  ChapterRuleSet,
  ScoringAdjustment,
} from "../src/rule-types.js";
import type {
  NoteClause,
  ClassifiedClause,
  ClauseType,
  ExclusionParams as CompilerExclusionParams,
} from "../compiler/types.js";
import type {
  ClassifyInput,
  ClassifyResult,
  Candidate,
  HsNode,
  RuleCondition,
} from "../src/types.js";

describe("types", () => {
  it("ClassifyInput accepts description only", () => {
    const input: ClassifyInput = { description: "wooden chair" };
    expect(input.description).toBe("wooden chair");
    expect(input.attributes).toBeUndefined();
  });

  it("ClassifyInput accepts description with attributes", () => {
    const input: ClassifyInput = {
      description: "wooden chair",
      attributes: { material: "wood", weight_kg: 5.2 },
    };
    expect(input.attributes?.material).toBe("wood");
  });

  it("ClassifyResult has candidates and needs_review", () => {
    const result: ClassifyResult = {
      candidates: [
        {
          hscode: "940360",
          description: "Other wooden furniture",
          confidence: 0.85,
          reasoning: ["Chapter 94", "Heading 9403", "Subheading 940360"],
        },
      ],
      needs_review: false,
    };
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].hscode).toBe("940360");
    expect(result.needs_review).toBe(false);
  });

  it("HsNode supports section field", () => {
    const node: HsNode = {
      code: "01",
      description: "Animals; live",
      level: 2,
      section: "I",
      parent: undefined,
      children: [],
    };
    expect(node.section).toBe("I");
    expect(node.children).toHaveLength(0);
  });
});

describe("rule-types type checking", () => {
  it("ChapterRuleSet is structurally valid", () => {
    const ruleSet: ChapterRuleSet = {
      chapter: "87",
      preScoringRules: [
        {
          clauseType: "exclusion",
          params: { excludedCodes: ["8706"], reason: "test" },
        },
      ],
      scoringRules: [
        {
          clauseType: "definition",
          params: { term: "tractor", meaning: "hauling vehicle", appliesTo: ["8701"] },
        },
      ],
      partsRules: [
        {
          clauseType: "parts_rule",
          params: { rule: "principal_use" },
        },
      ],
    };
    expect(ruleSet.chapter).toBe("87");
    expect(ruleSet.preScoringRules).toHaveLength(1);
    expect(ruleSet.scoringRules).toHaveLength(1);
    expect(ruleSet.partsRules).toHaveLength(1);
  });

  it("ScoringAdjustment is structurally valid", () => {
    const adj: ScoringAdjustment = { factor: 1.05, reason: "Definition match" };
    expect(adj.factor).toBe(1.05);
  });

  it("NoteClause is structurally valid", () => {
    const clause: NoteClause = {
      source: "chapter",
      noteNumber: 2,
      text: "For the purposes of this Chapter...",
    };
    expect(clause.source).toBe("chapter");
    expect(clause.subItem).toBeUndefined();
  });

  it("ClassifiedClause extends NoteClause", () => {
    const classified: ClassifiedClause = {
      source: "section",
      noteNumber: 1,
      text: "This Section does not cover...",
      clauseType: "exclusion",
      params: { excludedCodes: ["9503", "9508"], reason: "Section XVII Note 1" },
    };
    expect(classified.clauseType).toBe("exclusion");
  });

  it("ClauseType covers all 5 types", () => {
    const types: ClauseType[] = ["exclusion", "definition", "routing", "parts_rule", "scope"];
    expect(types).toHaveLength(5);
  });
});
