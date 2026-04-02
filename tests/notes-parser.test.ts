// tests/notes-parser.test.ts
import { describe, it, expect } from "vitest";
import { parseNotes } from "../compiler/notes-parser.js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("parseNotes", () => {
  it("returns empty array for empty input", () => {
    expect(parseNotes("")).toEqual([]);
  });

  it("returns empty array for input with no recognized headers", () => {
    expect(parseNotes("Some random text without headers")).toEqual([]);
  });

  describe("section notes", () => {
    it("parses simple section note", () => {
      const md = `## Section XVII Notes

1. This Section does not cover articles of heading 9503.`;
      const result = parseNotes(md);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        source: "section",
        noteNumber: 1,
        text: "This Section does not cover articles of heading 9503.",
      });
    });

    it("parses multiple section notes", () => {
      const md = `## Section XVII Notes

1. First note text.

2. Second note text.`;
      const result = parseNotes(md);
      expect(result).toHaveLength(2);
      expect(result[0].noteNumber).toBe(1);
      expect(result[1].noteNumber).toBe(2);
      expect(result[0].source).toBe("section");
      expect(result[1].source).toBe("section");
    });
  });

  describe("sub-item parsing", () => {
    it("parses notes with (a)(b) sub-items", () => {
      const md = `## Section XVII Notes

4. For the purposes of this Section:
  (a) road and rail vehicles are classified in Chapter 87;
  (b) amphibious motor vehicles are classified in Chapter 87;
  (c) aircraft road vehicles are classified in Chapter 88.`;
      const result = parseNotes(md);
      expect(result).toHaveLength(3);
      expect(result[0].subItem).toBe("(a)");
      expect(result[0].noteNumber).toBe(4);
      expect(result[0].text).toBe("road and rail vehicles are classified in Chapter 87;");
      expect(result[1].subItem).toBe("(b)");
      expect(result[2].subItem).toBe("(c)");
    });

    it("preserves note-level preamble text in sub-items", () => {
      const md = `## Section XVII Notes

4. For the purposes of this Section:
  (a) vehicles go to Chapter 87;`;
      const result = parseNotes(md);
      expect(result[0].text).toBe("vehicles go to Chapter 87;");
      expect(result[0].subItem).toBe("(a)");
    });
  });

  describe("chapter notes", () => {
    it("parses chapter notes with correct source", () => {
      const md = `## Chapter 87 Notes

1. This Chapter does not cover railway rolling-stock.`;
      const result = parseNotes(md);
      expect(result).toHaveLength(1);
      expect(result[0].source).toBe("chapter");
      expect(result[0].noteNumber).toBe(1);
    });
  });

  describe("multi-paragraph splitting", () => {
    it("splits multi-paragraph note into separate clauses", () => {
      const md = `## Chapter 87 Notes

2. For the purposes of this Chapter, "tractors" means vehicles constructed essentially for hauling.

Machines and working tools designed for fitting to tractors remain classified in their respective headings.`;
      const result = parseNotes(md);
      expect(result).toHaveLength(2);
      expect(result[0].noteNumber).toBe(2);
      expect(result[0].text).toContain("tractors");
      expect(result[0].text).toContain("hauling");
      expect(result[1].noteNumber).toBe(2);
      expect(result[1].text).toContain("Machines and working tools");
    });
  });

  describe("subheading notes", () => {
    it("parses subheading notes with correct source", () => {
      const md = `## Subheading Notes

1. Subheading 8708.22 covers front windscreens.`;
      const result = parseNotes(md);
      expect(result).toHaveLength(1);
      expect(result[0].source).toBe("subheading");
      expect(result[0].noteNumber).toBe(1);
    });
  });

  describe("combined parsing", () => {
    it("parses mixed section + chapter + subheading notes", () => {
      const md = `## Section XVII Notes

1. This Section does not cover articles of heading 9503.

## Chapter 87 Notes

1. This Chapter does not cover railway rolling-stock.

## Subheading Notes

1. Subheading 8708.22 covers front windscreens.`;
      const result = parseNotes(md);
      expect(result).toHaveLength(3);
      expect(result[0].source).toBe("section");
      expect(result[1].source).toBe("chapter");
      expect(result[2].source).toBe("subheading");
    });
  });

  describe("full data files", () => {
    it("parses section-17.md correctly", () => {
      const md = readFileSync(resolve(process.cwd(), "data/notes/section-17.md"), "utf-8");
      const result = parseNotes(md);
      // Section XVII has: Note 1 (1), Note 2 with 12 sub-items (12),
      // Note 3 (1), Note 4 with 3 sub-items (3), Note 5 with 3 sub-items (3) = 20
      expect(result.length).toBeGreaterThanOrEqual(18);
      expect(result.every((c) => c.source === "section")).toBe(true);
    });

    it("parses chapter-87.md correctly", () => {
      const md = readFileSync(resolve(process.cwd(), "data/notes/chapter-87.md"), "utf-8");
      const result = parseNotes(md);
      // Chapter 87: Note 1 (1), Note 2 (2 paragraphs), Note 3 (1), Note 4 (1)
      // Subheading: Note 1 (1) = 6
      expect(result.length).toBeGreaterThanOrEqual(5);
      const chapterClauses = result.filter((c) => c.source === "chapter");
      const subheadingClauses = result.filter((c) => c.source === "subheading");
      expect(chapterClauses.length).toBeGreaterThanOrEqual(4);
      expect(subheadingClauses.length).toBeGreaterThanOrEqual(1);
    });
  });
});
