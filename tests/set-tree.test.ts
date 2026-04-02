import { describe, it, expect, beforeEach } from "vitest";
import { setTree, classify } from "../src/index.js";
import type { HsNode } from "../src/index.js";

describe("setTree", () => {
  const minimalTree: HsNode[] = [
    {
      code: "01",
      description: "Live animals",
      level: 2,
      section: "I",
      children: [
        {
          code: "0101",
          description: "Live horses, asses, mules and hinnies",
          level: 4,
          parent: "01",
          children: [
            {
              code: "010110",
              description: "Pure-bred breeding animals",
              level: 6,
              parent: "0101",
              children: [],
            },
          ],
        },
      ],
    },
  ];

  beforeEach(() => {
    setTree(minimalTree);
  });

  it("should allow classify to work after setTree", () => {
    const result = classify({ description: "live horse" });
    expect(result.candidates.length).toBeGreaterThan(0);
    expect(result.candidates[0].hscode).toMatch(/^0101/);
  });

  it("should throw if classify called without loading tree", () => {
    setTree(null as unknown as HsNode[]);
    expect(() => classify({ description: "horse" })).toThrow("Tree not loaded");
  });
});
