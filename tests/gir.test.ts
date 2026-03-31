// tests/gir.test.ts
import { describe, it, expect } from "vitest";
import { applyGir3a, applyGir3c } from "../src/gir.js";
import type { Candidate } from "../src/types.js";

describe("applyGir3a", () => {
  it("sorts by confidence descending", () => {
    const candidates: Candidate[] = [
      { hscode: "0101", description: "Horses", confidence: 0.5, reasoning: [], matchedTokenCount: 1 },
      { hscode: "0102", description: "Cattle", confidence: 0.8, reasoning: [], matchedTokenCount: 1 },
    ];
    const result = applyGir3a(candidates);
    expect(result[0].hscode).toBe("0102");
  });

  it("breaks ties by matchedTokenCount (more matched tokens = more specific)", () => {
    const candidates: Candidate[] = [
      { hscode: "0101", description: "Horses", confidence: 0.8, reasoning: ["a", "b", "c", "d"], matchedTokenCount: 2 },
      { hscode: "0102", description: "Cattle", confidence: 0.8, reasoning: ["a", "b", "c", "d"], matchedTokenCount: 5 },
    ];
    const result = applyGir3a(candidates);
    expect(result[0].hscode).toBe("0102");
  });
});

describe("applyGir3c", () => {
  it("picks last heading numerically when tied on both confidence and matchedTokenCount", () => {
    const candidates: Candidate[] = [
      { hscode: "0101", description: "Horses", confidence: 0.8, reasoning: ["a"], matchedTokenCount: 3 },
      { hscode: "0103", description: "Swine", confidence: 0.8, reasoning: ["a"], matchedTokenCount: 3 },
      { hscode: "0102", description: "Cattle", confidence: 0.8, reasoning: ["a"], matchedTokenCount: 3 },
    ];
    const result = applyGir3c(candidates);
    expect(result[0].hscode).toBe("0103");
  });

  it("does not reorder when no tie exists", () => {
    const candidates: Candidate[] = [
      { hscode: "0102", description: "Cattle", confidence: 0.9, reasoning: [], matchedTokenCount: 2 },
      { hscode: "0101", description: "Horses", confidence: 0.5, reasoning: [], matchedTokenCount: 1 },
    ];
    const result = applyGir3c(candidates);
    expect(result[0].hscode).toBe("0102");
  });
});
