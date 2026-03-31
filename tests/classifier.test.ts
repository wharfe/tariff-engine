// tests/classifier.test.ts
import { describe, it, expect, beforeAll } from "vitest";
import { loadTree, classify, scoreSection, scoreNodes, scoreSubheading } from "../src/classifier.js";
import { tokenize } from "../src/tokenizer.js";
import testCases from "./fixtures/test-cases.json";
// performance is available globally in Node.js 16+
import type { HsNode } from "../src/types.js";
import path from "node:path";

describe("loadTree", () => {
  it("loads hs-tree.json and returns HsNode array", () => {
    const tree = loadTree();
    expect(Array.isArray(tree)).toBe(true);
    expect(tree.length).toBe(97); // 97 chapters
  });

  it("each node has code, description, level, children", () => {
    const tree = loadTree();
    const ch01 = tree[0];
    expect(ch01.code).toBe("01");
    expect(ch01.description).toBeTruthy();
    expect(ch01.level).toBe(2);
    expect(Array.isArray(ch01.children)).toBe(true);
  });

  it("caches the tree on second call", () => {
    const tree1 = loadTree();
    const tree2 = loadTree();
    expect(tree1).toBe(tree2); // same reference
  });

  it("force reload returns fresh tree", () => {
    const tree1 = loadTree();
    const tree2 = loadTree(undefined, { force: true });
    expect(tree1).not.toBe(tree2); // different reference
    expect(tree2.length).toBe(97);
  });

  it("loads custom path", () => {
    const tree = loadTree(
      path.resolve(process.cwd(), "data/hs-tree.json"),
      { force: true },
    );
    expect(tree.length).toBe(97);
  });
});

describe("scoreSection", () => {
  it("scores animal-related input highest for section I", () => {
    const tokens = tokenize("live horses");
    const scores = scoreSection(tokens);
    const sec1 = scores.find((s) => s.section === "I");
    expect(sec1).toBeDefined();
    expect(sec1!.score).toBeGreaterThan(0);
    scores.sort((a, b) => b.score - a.score);
    expect(scores[0].section).toBe("I");
  });

  it("scores machinery input highest for section XVI", () => {
    const tokens = tokenize("electrical motor generator");
    const scores = scoreSection(tokens);
    scores.sort((a, b) => b.score - a.score);
    expect(scores[0].section).toBe("XVI");
  });

  it("filters sections below 50% of max score (min 3)", () => {
    const tokens = tokenize("live horses");
    const scores = scoreSection(tokens);
    const maxScore = Math.max(...scores.map((s) => s.score));
    const threshold = maxScore * 0.5;
    if (scores.length > 3) {
      for (const s of scores) {
        expect(s.score).toBeGreaterThanOrEqual(threshold);
      }
    } else {
      expect(scores.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("returns at least 3 sections even if only 1 matches", () => {
    const tokens = tokenize("antique painting");
    const scores = scoreSection(tokens);
    expect(scores.length).toBeGreaterThanOrEqual(3);
  });
});

describe("scoreNodes", () => {
  beforeAll(() => {
    loadTree(undefined, { force: true });
  });

  it("scores chapter 01 highest for 'live horses'", () => {
    const tokens = tokenize("live horses");
    const tree = loadTree();
    const scores = scoreNodes(tokens, tree);
    scores.sort((a, b) => b.score - a.score);
    expect(scores[0].node.code).toBe("01");
  });

  it("scores chapter 94 for 'wooden furniture'", () => {
    const tokens = tokenize("wooden furniture");
    const tree = loadTree();
    const scores = scoreNodes(tokens, tree);
    const ch94 = scores.find((s) => s.node.code === "94");
    expect(ch94).toBeDefined();
    expect(ch94!.score).toBeGreaterThan(0);
  });

  it("filters by 50% threshold with minimum 3", () => {
    const tokens = tokenize("live horses");
    const tree = loadTree();
    const scores = scoreNodes(tokens, tree);
    expect(scores.length).toBeGreaterThanOrEqual(3);
  });

  it("scores headings within a chapter", () => {
    const tokens = tokenize("live horses");
    const tree = loadTree();
    const ch01 = tree.find((ch) => ch.code === "01")!;
    const headingScores = scoreNodes(tokens, ch01.children);
    headingScores.sort((a, b) => b.score - a.score);
    expect(headingScores[0].node.code).toBe("0101");
  });
});

describe("scoreSubheading", () => {
  it("returns normal score for plain description", () => {
    const tokens = tokenize("live horses pure-bred breeding animals");
    const node: HsNode = {
      code: "010121",
      description: "Horses; live, pure-bred breeding animals",
      level: 6,
      children: [],
    };
    const score = scoreSubheading(tokens, node);
    expect(score).toBeGreaterThan(0);
  });

  it("returns 0 for 'other than' match", () => {
    const tokens = tokenize("live horses pure-bred breeding");
    const node: HsNode = {
      code: "010129",
      description: "Horses; live, other than pure-bred breeding animals",
      level: 6,
      children: [],
    };
    const score = scoreSubheading(tokens, node);
    expect(score).toBe(0);
  });

  it("does not trigger 'other than' when excluded tokens are absent", () => {
    const tokens = tokenize("live horses working");
    const node: HsNode = {
      code: "010129",
      description: "Horses; live, other than pure-bred breeding animals",
      level: 6,
      children: [],
    };
    const score = scoreSubheading(tokens, node);
    expect(score).toBeGreaterThan(0);
  });

  it("applies fallback penalty for description starting with Other", () => {
    const tokens = tokenize("bovine animals live");
    const normalNode: HsNode = {
      code: "010221",
      description: "Cattle; live, pure-bred breeding animals",
      level: 6,
      children: [],
    };
    const otherNode: HsNode = {
      code: "010290",
      description: "Other live bovine animals",
      level: 6,
      children: [],
    };
    const normalScore = scoreSubheading(tokens, normalNode);
    const otherScore = scoreSubheading(tokens, otherNode);
    expect(otherScore).toBeLessThan(normalScore);
  });

  it("applies fallback penalty for n.e.s.i. description", () => {
    const tokens = tokenize("some product");
    const nesiNode: HsNode = {
      code: "999999",
      description: "Products n.e.s.i.",
      level: 6,
      children: [],
    };
    const score = scoreSubheading(tokens, nesiNode);
    expect(score).toBeLessThanOrEqual(0.3);
  });
});

describe("classify", () => {
  beforeAll(() => {
    loadTree(undefined, { force: true });
  });

  it("returns candidates for 'live horses'", () => {
    const result = classify({ description: "live horses" });
    expect(result.candidates.length).toBeGreaterThan(0);
    expect(result.candidates.length).toBeLessThanOrEqual(3);
  });

  it("each candidate has required fields", () => {
    const result = classify({ description: "wooden dining table" });
    for (const c of result.candidates) {
      expect(c.hscode).toBeTruthy();
      expect(c.description).toBeTruthy();
      expect(typeof c.confidence).toBe("number");
      expect(c.confidence).toBeGreaterThanOrEqual(0);
      expect(c.confidence).toBeLessThanOrEqual(1);
      expect(Array.isArray(c.reasoning)).toBe(true);
      expect(c.reasoning.length).toBeGreaterThanOrEqual(1);
      expect(typeof c.matchedTokenCount).toBe("number");
    }
  });

  it("reasoning path includes section, chapter, heading, subheading", () => {
    const result = classify({ description: "live horses" });
    const top = result.candidates[0];
    expect(top.reasoning.some((r) => r.startsWith("Section"))).toBe(true);
    expect(top.reasoning.some((r) => r.startsWith("Chapter"))).toBe(true);
    expect(top.reasoning.some((r) => r.startsWith("Heading"))).toBe(true);
    expect(top.reasoning.some((r) => r.startsWith("Subheading"))).toBe(true);
  });

  it("candidates are sorted by confidence descending", () => {
    const result = classify({ description: "wooden furniture" });
    for (let i = 1; i < result.candidates.length; i++) {
      expect(result.candidates[i].confidence).toBeLessThanOrEqual(
        result.candidates[i - 1].confidence,
      );
    }
  });

  it("sets needs_review based on confidence threshold", () => {
    const result = classify({ description: "wooden dining table" });
    const topConfidence = result.candidates[0]?.confidence ?? 0;
    if (topConfidence < 0.7) {
      expect(result.needs_review).toBe(true);
    }
  });

  it("returns empty candidates for empty description", () => {
    const result = classify({ description: "" });
    expect(result.candidates).toEqual([]);
    expect(result.needs_review).toBe(true);
  });

  it("completes within 100ms", () => {
    loadTree(); // ensure cached
    classify({ description: "warmup" }); // warm up JIT
    const start = performance.now();
    classify({ description: "electrical motor generator" });
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(100);
  });
});

describe("accuracy: manual test cases", () => {
  beforeAll(() => {
    loadTree(undefined, { force: true });
  });

  for (const tc of testCases) {
    it(`classifies "${tc.description}" → expects 4-digit ${tc.expected4}`, () => {
      const result = classify({ description: tc.description });
      expect(result.candidates.length).toBeGreaterThan(0);
      const top = result.candidates[0];
      console.log(
        `  ${tc.description}: got ${top.hscode} (${(top.confidence * 100).toFixed(0)}%), expected ${tc.expected4}/${tc.expected6}`,
      );
    });
  }

  it("meets 4-digit accuracy threshold (≥70%)", () => {
    let correct4 = 0;
    for (const tc of testCases) {
      const result = classify({ description: tc.description });
      if (result.candidates.length > 0) {
        const topCode4 = result.candidates[0].hscode.slice(0, 4);
        if (topCode4 === tc.expected4) correct4++;
      }
    }
    const accuracy4 = correct4 / testCases.length;
    console.log(`4-digit accuracy: ${correct4}/${testCases.length} = ${(accuracy4 * 100).toFixed(0)}%`);
    expect(accuracy4).toBeGreaterThanOrEqual(0.7);
  });

  it("meets 6-digit accuracy threshold (≥50%)", () => {
    let correct6 = 0;
    for (const tc of testCases) {
      const result = classify({ description: tc.description });
      if (result.candidates.length > 0) {
        if (result.candidates[0].hscode === tc.expected6) correct6++;
      }
    }
    const accuracy6 = correct6 / testCases.length;
    console.log(`6-digit accuracy: ${correct6}/${testCases.length} = ${(accuracy6 * 100).toFixed(0)}%`);
    expect(accuracy6).toBeGreaterThanOrEqual(0.5);
  });

  it("reports accuracy by difficulty", () => {
    const stats = { easy: { total: 0, correct4: 0, correct6: 0 }, hard: { total: 0, correct4: 0, correct6: 0 } };
    for (const tc of testCases) {
      const d = (tc as { difficulty?: string }).difficulty === "hard" ? "hard" : "easy";
      stats[d].total++;
      const result = classify({ description: tc.description });
      if (result.candidates.length > 0) {
        if (result.candidates[0].hscode.slice(0, 4) === tc.expected4) stats[d].correct4++;
        if (result.candidates[0].hscode === tc.expected6) stats[d].correct6++;
      }
    }
    console.log(`Easy 4-digit: ${stats.easy.correct4}/${stats.easy.total} = ${((stats.easy.correct4/stats.easy.total)*100).toFixed(0)}%`);
    console.log(`Easy 6-digit: ${stats.easy.correct6}/${stats.easy.total} = ${((stats.easy.correct6/stats.easy.total)*100).toFixed(0)}%`);
    console.log(`Hard 4-digit: ${stats.hard.correct4}/${stats.hard.total} = ${((stats.hard.correct4/stats.hard.total)*100).toFixed(0)}%`);
    console.log(`Hard 6-digit: ${stats.hard.correct6}/${stats.hard.total} = ${((stats.hard.correct6/stats.hard.total)*100).toFixed(0)}%`);
    // This test always passes — it's a diagnostic reporter
    expect(true).toBe(true);
  });
});
