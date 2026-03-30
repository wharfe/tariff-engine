// tests/types.test.ts
import { describe, it, expect } from "vitest";
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
