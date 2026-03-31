// tests/classifier.test.ts
import { describe, it, expect, beforeAll } from "vitest";
import { loadTree } from "../src/classifier.js";
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
