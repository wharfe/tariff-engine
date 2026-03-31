import { describe, it, expect } from "vitest";
import { evaluateCondition } from "../src/rule-engine.js";

describe("evaluateCondition", () => {
  it("equals: case-insensitive string comparison", () => {
    expect(
      evaluateCondition(
        { type: "equals", field: "material", value: "Wood" },
        { material: "wood" },
      ),
    ).toBe(true);
  });

  it("equals: case-insensitive both directions", () => {
    expect(
      evaluateCondition(
        { type: "equals", field: "material", value: "steel" },
        { material: "STEEL" },
      ),
    ).toBe(true);
  });

  it("equals: non-matching returns false", () => {
    expect(
      evaluateCondition(
        { type: "equals", field: "material", value: "wood" },
        { material: "metal" },
      ),
    ).toBe(false);
  });

  it("gt: numeric comparison", () => {
    expect(
      evaluateCondition(
        { type: "gt", field: "weight_kg", value: 10 },
        { weight_kg: 15 },
      ),
    ).toBe(true);
  });

  it("contains: string inclusion", () => {
    expect(
      evaluateCondition(
        { type: "contains", field: "description", value: "wood" },
        { description: "wooden table" },
      ),
    ).toBe(true);
  });

  it("returns false for undefined field", () => {
    expect(
      evaluateCondition(
        { type: "equals", field: "color", value: "red" },
        {},
      ),
    ).toBe(false);
  });
});
