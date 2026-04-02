// tests/rule-generator.test.ts
import { describe, it, expect } from "vitest";
import { generateRules } from "../compiler/rule-generator.js";
import type { ClassifiedClause } from "../compiler/types.js";
import type { ChapterRuleSet } from "../src/rule-types.js";

describe("generateRules", () => {
  it("sorts exclusion clauses into preScoringRules", () => {
    const clauses: ClassifiedClause[] = [
      {
        source: "chapter",
        noteNumber: 1,
        text: "This Chapter does not cover railway...",
        clauseType: "exclusion",
        params: { excludedCodes: ["87"], reason: "rail only excluded" },
      },
    ];
    const result = generateRules(clauses, "87");
    expect(result.chapter).toBe("87");
    expect(result.preScoringRules).toHaveLength(1);
    expect(result.preScoringRules[0].clauseType).toBe("exclusion");
    expect(result.scoringRules).toHaveLength(0);
    expect(result.partsRules).toHaveLength(0);
  });

  it("sorts routing clauses into preScoringRules", () => {
    const clauses: ClassifiedClause[] = [
      {
        source: "chapter",
        noteNumber: 3,
        text: "Motor chassis fitted with cabs...",
        clauseType: "routing",
        params: {
          target: "8702-8704",
          conditions: [
            { type: "contains", field: "description", value: "chassis" },
            { type: "contains", field: "description", value: "cab" },
          ],
        },
      },
    ];
    const result = generateRules(clauses, "87");
    expect(result.preScoringRules).toHaveLength(1);
    expect(result.preScoringRules[0].clauseType).toBe("routing");
  });

  it("sorts definition clauses into scoringRules", () => {
    const clauses: ClassifiedClause[] = [
      {
        source: "chapter",
        noteNumber: 2,
        text: "tractors means...",
        clauseType: "definition",
        params: { term: "tractor", meaning: "hauling vehicle", appliesTo: ["8701"] },
      },
    ];
    const result = generateRules(clauses, "87");
    expect(result.scoringRules).toHaveLength(1);
    expect(result.scoringRules[0].clauseType).toBe("definition");
  });

  it("sorts scope clauses into scoringRules", () => {
    const clauses: ClassifiedClause[] = [
      {
        source: "subheading",
        noteNumber: 1,
        text: "8708.22 covers windscreens...",
        clauseType: "scope",
        params: {
          heading: "870822",
          covers: "windscreens",
          conditions: [{ type: "contains", field: "description", value: "windscreen" }],
        },
      },
    ];
    const result = generateRules(clauses, "87");
    expect(result.scoringRules).toHaveLength(1);
    expect(result.scoringRules[0].clauseType).toBe("scope");
  });

  it("sorts parts_rule clauses into partsRules", () => {
    const clauses: ClassifiedClause[] = [
      {
        source: "section",
        noteNumber: 3,
        text: "principal use...",
        clauseType: "parts_rule",
        params: { rule: "principal_use", affectedCodes: ["86", "87", "88"] },
      },
    ];
    const result = generateRules(clauses, "87");
    expect(result.partsRules).toHaveLength(1);
    expect(result.partsRules[0].clauseType).toBe("parts_rule");
  });

  it("handles mixed clause types", () => {
    const clauses: ClassifiedClause[] = [
      {
        source: "chapter", noteNumber: 1, text: "exclusion",
        clauseType: "exclusion",
        params: { excludedCodes: ["87"], reason: "test" },
      },
      {
        source: "chapter", noteNumber: 2, text: "definition",
        clauseType: "definition",
        params: { term: "tractor", meaning: "hauling", appliesTo: ["8701"] },
      },
      {
        source: "chapter", noteNumber: 3, text: "routing",
        clauseType: "routing",
        params: { target: "8702-8704", conditions: [] },
      },
      {
        source: "section", noteNumber: 3, text: "parts",
        clauseType: "parts_rule",
        params: { rule: "principal_use" },
      },
      {
        source: "subheading", noteNumber: 1, text: "scope",
        clauseType: "scope",
        params: { heading: "870822", covers: "windscreens", conditions: [] },
      },
    ];
    const result = generateRules(clauses, "87");
    expect(result.preScoringRules).toHaveLength(2); // exclusion + routing
    expect(result.scoringRules).toHaveLength(2);     // definition + scope
    expect(result.partsRules).toHaveLength(1);        // parts_rule
  });

  it("strips NoteClause metadata from output", () => {
    const clauses: ClassifiedClause[] = [
      {
        source: "chapter", noteNumber: 1, text: "full note text here",
        clauseType: "exclusion",
        params: { excludedCodes: ["87"], reason: "test" },
      },
    ];
    const result = generateRules(clauses, "87");
    const rule = result.preScoringRules[0];
    // Rule should not contain NoteClause fields
    expect((rule as any).source).toBeUndefined();
    expect((rule as any).noteNumber).toBeUndefined();
    expect((rule as any).text).toBeUndefined();
  });

  it("returns empty arrays for empty input", () => {
    const result = generateRules([], "87");
    expect(result.chapter).toBe("87");
    expect(result.preScoringRules).toHaveLength(0);
    expect(result.scoringRules).toHaveLength(0);
    expect(result.partsRules).toHaveLength(0);
  });
});
