import { describe, it, expect } from "vitest";
import { parseCsvContent, buildTree } from "../compiler/parse-nomenclature.js";
import type { HsNode } from "../src/types.js";

const SAMPLE_CSV = `section,hscode,description,parent,level
I,01,Animals; live,TOTAL,2
I,0101,"Horses, asses, mules and hinnies; live",01,4
I,010121,"Horses; live, pure-bred breeding animals",0101,6
I,010129,"Horses; live, other than pure-bred breeding animals",0101,6`;

describe("parseCsvContent", () => {
  it("parses CSV rows into flat HsNode array", () => {
    const nodes = parseCsvContent(SAMPLE_CSV);
    expect(nodes).toHaveLength(4);
    expect(nodes[0]).toEqual({
      code: "01",
      description: "Animals; live",
      level: 2,
      section: "I",
      parent: undefined,
      children: [],
    });
  });

  it("handles quoted descriptions with commas", () => {
    const nodes = parseCsvContent(SAMPLE_CSV);
    expect(nodes[1].description).toBe(
      "Horses, asses, mules and hinnies; live",
    );
  });

  it("sets parent to undefined for chapters (parent=TOTAL)", () => {
    const nodes = parseCsvContent(SAMPLE_CSV);
    expect(nodes[0].parent).toBeUndefined();
  });

  it("sets parent code for headings and subheadings", () => {
    const nodes = parseCsvContent(SAMPLE_CSV);
    expect(nodes[1].parent).toBe("01");
    expect(nodes[2].parent).toBe("0101");
  });

  it("excludes TOTAL rows", () => {
    const csvWithTotal = `section,hscode,description,parent,level
I,01,Animals; live,TOTAL,2
TOTAL,TOTAL,Total of all HS2022 commodities,TOTAL,5`;
    const nodes = parseCsvContent(csvWithTotal);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].code).toBe("01");
  });
});

describe("buildTree", () => {
  it("builds hierarchical tree from flat nodes", () => {
    const nodes = parseCsvContent(SAMPLE_CSV);
    const tree = buildTree(nodes);
    expect(tree).toHaveLength(1); // 1 chapter
    expect(tree[0].code).toBe("01");
    expect(tree[0].children).toHaveLength(1); // 1 heading
    expect(tree[0].children[0].code).toBe("0101");
    expect(tree[0].children[0].children).toHaveLength(2); // 2 subheadings
  });

  it("preserves section info in tree nodes", () => {
    const nodes = parseCsvContent(SAMPLE_CSV);
    const tree = buildTree(nodes);
    expect(tree[0].section).toBe("I");
    expect(tree[0].children[0].section).toBe("I");
  });
});
