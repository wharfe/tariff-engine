// tests/chapter-63.test.ts
// A/B comparison test: Chapter 63 accuracy with and without rules.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { classify, loadTree } from "../src/classifier.js";
import { loadRules, clearRules } from "../src/rule-applier.js";
import testCases from "./fixtures/chapter-63-cases.json";

interface TestCase {
  description: string;
  expected4: string;
  expected6: string;
  notes: string;
}

describe.each([
  { label: "without rules", useRules: false },
  { label: "with rules", useRules: true },
])("Chapter 63 accuracy ($label)", ({ label, useRules }) => {
  beforeAll(() => {
    loadTree();
    clearRules();
    if (useRules) {
      loadRules("63");
    }
  });

  afterAll(() => {
    clearRules();
  });

  let correct4 = 0;
  let correct6 = 0;
  const total = (testCases as TestCase[]).length;

  it.each(testCases as TestCase[])(
    "$description -> $expected4",
    ({ description, expected4, expected6, notes }) => {
      const result = classify({ description });
      const top = result.candidates[0];

      const match4 = top?.hscode.startsWith(expected4) ?? false;
      const match6 = top?.hscode === expected6;

      if (match4) correct4++;
      if (match6) correct6++;

      if (!match4) {
        console.log(
          `  [${label}] MISS: "${description}" -> got ${top?.hscode ?? "none"}, expected ${expected4}* (${notes})`,
        );
      }

      expect(result.candidates.length).toBeGreaterThan(0);
    },
  );

  it("reports accuracy", () => {
    console.log(`\n  [${label}] 4-digit: ${correct4}/${total} (${((correct4 / total) * 100).toFixed(0)}%)`);
    console.log(`  [${label}] 6-digit: ${correct6}/${total} (${((correct6 / total) * 100).toFixed(0)}%)\n`);
  });
});
