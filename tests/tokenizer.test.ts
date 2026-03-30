import { describe, it, expect } from "vitest";
import { tokenize } from "../src/tokenizer.js";

describe("tokenize", () => {
  it("lowercases and splits basic description", () => {
    expect(tokenize("Wooden Chair")).toEqual(["wooden", "chair"]);
  });

  it("removes stop words", () => {
    expect(tokenize("the table of wood")).toEqual(["table", "wood"]);
  });

  it("removes punctuation except hyphens", () => {
    expect(tokenize("motor cars, trucks & buses")).toEqual([
      "motor",
      "cars",
      "trucks",
      "buses",
    ]);
  });

  it("preserves hyphenated compound words as single token", () => {
    expect(tokenize("high-quality steel")).toEqual(["high-quality", "steel"]);
  });

  it("filters single-character tokens", () => {
    expect(tokenize("a b c wood")).toEqual(["wood"]);
  });

  it("handles semicolons in HS descriptions", () => {
    expect(tokenize("Horses; live, pure-bred breeding animals")).toEqual([
      "horses",
      "live",
      "pure-bred",
      "breeding",
      "animals",
    ]);
  });

  it("handles empty string", () => {
    expect(tokenize("")).toEqual([]);
  });

  it("handles numeric content", () => {
    expect(tokenize("weighing less than 50kg")).toEqual([
      "weighing",
      "less",
      "than",
      "50kg",
    ]);
  });
});
