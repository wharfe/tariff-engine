// tests/lookup.test.ts
// Unit tests for the build-time phrase table lookup (src/lookup.ts) and its use in classify().

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { classify, loadTree } from "../src/classifier.js";
import { lookup, lookupStatus, setLookup, LOOKUP_THRESHOLD, type LookupRow } from "../src/lookup.js";
import { BUNDLED_LOOKUP } from "../src/lookup-data.js";
import type { HsNode } from "../src/types.js";

const ROWS: LookupRow[] = [
  { p: "laptop computer", c: "847130", k: 0.95 },
  { p: "notebook computer 14 inch", c: "847130", k: 0.9 },
  { p: "desktop computer tower", c: "847141", k: 0.9 },
  { p: "steel bolt", c: "731815", k: 0.9 },
  { p: "steel nut", c: "731816", k: 0.9 },
  { p: "steel washer", c: "731822", k: 0.9 },
  { p: "knitted cotton shirt", c: "610510", k: 0.9 },
  { p: "non-woven fabric roll", c: "560313", k: 0.9 },
  { p: "polypropylene non-woven fabric", c: "560313", k: 0.9 },
  { p: "ghost row not in tree", c: "000001", k: 0.9 },
];

let tree: HsNode[];

beforeAll(() => {
  tree = loadTree();
  setLookup(ROWS);
});

afterAll(() => {
  setLookup(BUNDLED_LOOKUP);
});

describe("lookup scoring", () => {
  it("an exact phrase scores 1", () => {
    const hit = lookup("laptop computer", tree);
    expect(hit?.row.c).toBe("847130");
    expect(hit?.score).toBeCloseTo(1, 5);
  });

  it("unexplained extra words lower the score", () => {
    const plain = lookup("laptop computer", tree)!;
    const noisy = lookup("laptop computer titanium widget gold", tree)!;
    expect(noisy.row.c).toBe("847130");
    expect(noisy.score).toBeLessThan(plain.score);
  });

  it("a single shared word is never a hit", () => {
    expect(lookup("computer", tree)).toBeNull();
    expect(lookup("steel", tree)).toBeNull();
  });

  it("is deterministic", () => {
    const a = lookup("steel bolt nut", tree);
    const b = lookup("steel bolt nut", tree);
    expect(a).toEqual(b);
  });

  it("breaks ties toward the larger code (same direction as GIR 3(c))", () => {
    // "steel bolt" and "steel nut" score the same against "steel bolt nut"
    expect(lookup("steel bolt nut", tree)?.row.c).toBe("731816");
  });
});

describe("negation", () => {
  it.each(["cotton shirt, not knitted", "shirt without knitting", "fabric other than knitted", "non knitted cotton shirt"])(
    "skips the table for %s",
    (d) => {
      expect(lookup(d, tree)).toBeNull();
    },
  );

  it("does not treat hyphenated product words as negation", () => {
    expect(lookup("non-woven fabric roll", tree)?.row.c).toBe("560313");
  });
});

describe("table hygiene", () => {
  it("drops rows whose code is not in the tree", () => {
    lookup("laptop computer", tree);
    expect(lookupStatus().dropped).toBe(1);
    expect(lookupStatus().rows).toBe(ROWS.length - 1);
  });

  it("works with the table disabled", () => {
    setLookup(null);
    expect(lookup("laptop computer", tree)).toBeNull();
    expect(lookupStatus().enabled).toBe(false);
    expect(classify({ description: "laptop computer" }).candidates.length).toBeGreaterThan(0);
    setLookup(ROWS);
  });
});

describe("classify with the table", () => {
  it("puts a table hit first with the tree path and the matched phrase in the reasoning", () => {
    const r = classify({ description: "laptop computer" });
    const top = r.candidates[0];
    expect(top.hscode).toBe("847130");
    expect(top.reasoning.some((x) => x.startsWith("Section"))).toBe(true);
    expect(top.reasoning.some((x) => x.startsWith("Subheading 847130"))).toBe(true);
    expect(top.reasoning.some((x) => x.startsWith('Lookup: "laptop computer"'))).toBe(true);
  });

  it("keeps candidates sorted by confidence", () => {
    const c = classify({ description: "laptop computer" }).candidates;
    for (let i = 1; i < c.length; i++) expect(c[i].confidence).toBeLessThanOrEqual(c[i - 1].confidence);
  });

  it("leaves results unchanged below the threshold", () => {
    setLookup(null);
    const rulesOnly = classify({ description: "steel bolt galvanized hex zinc m8 pack" });
    setLookup(ROWS);
    const hit = lookup("steel bolt galvanized hex zinc m8 pack", tree);
    expect(hit === null || hit.score < LOOKUP_THRESHOLD).toBe(true);
    expect(classify({ description: "steel bolt galvanized hex zinc m8 pack" })).toEqual(rulesOnly);
  });
});
