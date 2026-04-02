// tests/rule-applier.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  loadRules,
  setRules,
  clearRules,
  applyPreScoringRules,
  applyScoringAdjustments,
  applyPartsRules,
} from "../src/rule-applier.js";
import type { ChapterRuleSet, ScoringAdjustment } from "../src/rule-types.js";
import type { HsNode, ClassifyInput, Candidate } from "../src/types.js";

// Helper: create a minimal HsNode
function makeNode(code: string, desc: string): HsNode {
  return { code, description: desc, level: 4, children: [] };
}

// Helper: create a minimal Candidate
function makeCandidate(hscode: string, desc: string): Candidate {
  return {
    hscode,
    description: desc,
    confidence: 0.5,
    reasoning: [],
    matchedTokenCount: 1,
  };
}

describe("loadRules", () => {
  afterAll(() => clearRules());

  it("loads chapter-87.json successfully", () => {
    const rules = loadRules("87");
    expect(rules).not.toBeNull();
    expect(rules!.chapter).toBe("87");
    expect(rules!.preScoringRules.length).toBeGreaterThan(0);
    expect(rules!.scoringRules.length).toBeGreaterThan(0);
    expect(rules!.partsRules.length).toBeGreaterThan(0);
  });

  it("returns null for non-existent chapter", () => {
    const rules = loadRules("99");
    expect(rules).toBeNull();
  });

  it("caches loaded rules", () => {
    const first = loadRules("87");
    const second = loadRules("87");
    expect(first).toBe(second); // same reference
  });
});

describe("setRules / clearRules", () => {
  afterAll(() => clearRules());

  it("injects rules for a chapter", () => {
    const custom: ChapterRuleSet = {
      chapter: "01",
      preScoringRules: [],
      scoringRules: [],
      partsRules: [],
    };
    setRules("01", custom);
    const loaded = loadRules("01");
    expect(loaded).toBe(custom);
  });

  it("clearRules removes all cached rules", () => {
    setRules("01", { chapter: "01", preScoringRules: [], scoringRules: [], partsRules: [] });
    clearRules();
    // After clear, loadRules("01") would try to load from filesystem (which doesn't exist)
    const loaded = loadRules("01");
    expect(loaded).toBeNull();
  });
});

describe("applyPreScoringRules", () => {
  let rules: ChapterRuleSet;

  beforeAll(() => {
    rules = loadRules("87")!;
  });

  afterAll(() => clearRules());

  it("does not filter when exclusion condition not met", () => {
    const input: ClassifyInput = { description: "sedan car gasoline" };
    const nodes = [makeNode("8703", "Motor cars"), makeNode("8706", "Chassis")];
    const result = applyPreScoringRules(rules.preScoringRules, input, nodes);
    // No rail-related content, so exclusion rule should not fire
    expect(result).toHaveLength(2);
  });

  it("routes chassis with cab away from 8706", () => {
    const input: ClassifyInput = { description: "motor chassis fitted with cab for passenger car" };
    const nodes = [
      makeNode("8702", "Buses"),
      makeNode("8703", "Motor cars"),
      makeNode("8704", "Trucks"),
      makeNode("8706", "Chassis"),
    ];
    const result = applyPreScoringRules(rules.preScoringRules, input, nodes);
    // 8706 should be filtered out (chassis+cab routing rule)
    const codes = result.map((n) => n.code);
    expect(codes).not.toContain("8706");
    expect(codes).toContain("8703");
  });

  it("routes children's bicycle to 8712", () => {
    const input: ClassifyInput = { description: "children bicycle with training wheels" };
    const nodes = [
      makeNode("8712", "Bicycles"),
      makeNode("9503", "Toys"),
    ];
    const result = applyPreScoringRules(rules.preScoringRules, input, nodes);
    const codes = result.map((n) => n.code);
    expect(codes).toContain("8712");
  });
});

describe("applyScoringAdjustments", () => {
  let rules: ChapterRuleSet;

  beforeAll(() => {
    rules = loadRules("87")!;
  });

  afterAll(() => clearRules());

  it("boosts confidence for tractor heading when description contains hauling terms", () => {
    const input: ClassifyInput = { description: "agricultural tractor for hauling" };
    const candidate = makeCandidate("870191", "Agricultural tractors");
    const adjustments = applyScoringAdjustments(rules.scoringRules, input, candidate);
    // Should have a definition boost
    const defAdj = adjustments.find((a) => a.reason.includes("Definition"));
    expect(defAdj).toBeDefined();
    expect(defAdj!.factor).toBeGreaterThan(1.0);
  });

  it("returns no adjustments when no rules match", () => {
    const input: ClassifyInput = { description: "motorcycle 250cc" };
    const candidate = makeCandidate("871120", "Motorcycles 50-250cc");
    const adjustments = applyScoringAdjustments(rules.scoringRules, input, candidate);
    // No definition or scope match for motorcycle in current rules
    expect(adjustments.every((a) => a.factor === 1.0)).toBe(true);
  });
});

describe("applyPartsRules", () => {
  let rules: ChapterRuleSet;

  beforeAll(() => {
    rules = loadRules("87")!;
  });

  afterAll(() => clearRules());

  it("detects parts in description", () => {
    const input: ClassifyInput = { description: "bicycle parts rear derailleur" };
    const result = applyPartsRules(rules.partsRules, input);
    expect(result).not.toBeNull();
    expect(result!.isPart).toBe(true);
  });

  it("returns null for non-parts description", () => {
    const input: ClassifyInput = { description: "sedan car 1500cc gasoline" };
    const result = applyPartsRules(rules.partsRules, input);
    // Not a parts description, so should return null or isPart=false
    expect(result === null || result.isPart === false).toBe(true);
  });
});
