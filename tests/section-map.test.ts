import { describe, it, expect } from "vitest";
import { SECTION_MAP } from "../src/section-map.js";

describe("SECTION_MAP", () => {
  it("contains all 21 sections", () => {
    expect(SECTION_MAP).toHaveLength(21);
  });

  it("each entry has required fields", () => {
    for (const entry of SECTION_MAP) {
      expect(entry.section).toBeTruthy();
      expect(entry.title).toBeTruthy();
      expect(entry.keywords.length).toBeGreaterThan(0);
      expect(entry.chapters.length).toBeGreaterThan(0);
    }
  });

  it("covers all 97 chapters (excluding 77 and 99)", () => {
    const allChapters = SECTION_MAP.flatMap((s) => s.chapters);
    expect(allChapters.length).toBeGreaterThanOrEqual(96);
  });

  it("section I covers chapters 01-05", () => {
    const sec1 = SECTION_MAP.find((s) => s.section === "I");
    expect(sec1?.chapters).toEqual(["01", "02", "03", "04", "05"]);
    expect(sec1?.title).toContain("animal");
  });

  it("section XVI covers chapters 84-85", () => {
    const sec16 = SECTION_MAP.find((s) => s.section === "XVI");
    expect(sec16?.chapters).toEqual(["84", "85"]);
  });
});
