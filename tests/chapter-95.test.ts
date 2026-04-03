// tests/chapter-95.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { classify, loadTree } from "../src/classifier.js";
import { loadRules, clearRules } from "../src/rule-applier.js";
import testCases from "./fixtures/chapter-95-cases.json";

interface TestCase {
  description: string;
  expected4: string;
  expected6: string;
  notes: string;
}

describe.each([
  { label: "without rules", useRules: false },
  { label: "with rules", useRules: true },
])("Chapter 95 accuracy ($label)", ({ label, useRules }) => {
  beforeAll(() => {
    loadTree();
    clearRules();
    if (useRules) {
      loadRules("95");
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
    ({ description, expected4 }) => {
      const result = classify({ description });
      const top = result.candidates[0];

      const match4 = top?.hscode.startsWith(expected4) ?? false;
      const match6 = top?.hscode === expected4;

      if (match4) correct4++;
      if (match6) correct6++;

      if (!match4) {
        console.log(
          `  [${label}] MISS: "${description}" -> got ${top?.hscode ?? "none"}, expected ${expected4}*`,
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
