// tests/lookup-accuracy.test.ts
// Acceptance gates for the bundled phrase table (docs/superpowers/specs/2026-10-02-jev-lookup-table.md).
// The threshold is tuned on separate tuning phrases; these questions are only used to judge.

import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect, beforeAll } from "vitest";
import { classify, loadTree } from "../src/classifier.js";
import { lookup, lookupStatus, setLookup, LOOKUP_THRESHOLD } from "../src/lookup.js";
import { BUNDLED_LOOKUP } from "../src/lookup-data.js";
import type { HsNode } from "../src/types.js";
import cases50 from "./fixtures/test-cases.json";
import baseline50 from "./fixtures/baseline-50.json";

interface Case {
  description: string;
  expected4: string;
  expected6: string;
}

const fixtures = resolve("tests/fixtures");
const cases144: Case[] = readdirSync(fixtures)
  .filter((f) => /^chapter-\d+-cases\.json$/.test(f))
  .sort()
  .flatMap((f) => JSON.parse(readFileSync(resolve(fixtures, f), "utf-8")) as Case[]);

let tree: HsNode[];

beforeAll(() => {
  tree = loadTree();
  setLookup(BUNDLED_LOOKUP);
});

describe("bundled table", () => {
  it("is present and non-empty", () => {
    lookup("laptop computer", tree);
    expect(lookupStatus().enabled).toBe(true);
    expect(lookupStatus().rows).toBeGreaterThan(1000);
    expect(lookupStatus().dropped).toBe(0);
  });

  it("first call (index build + one classification) stays under 300ms", () => {
    setLookup(BUNDLED_LOOKUP); // drops the index
    const start = performance.now();
    classify({ description: "stainless steel kitchen sink" });
    expect(performance.now() - start).toBeLessThan(300);
  });
});

describe("144 chapter questions", () => {
  it("heading top-1 >= 75% and chapter >= 85%", () => {
    let heading = 0;
    let chapter = 0;
    for (const c of cases144) {
      const top = classify({ description: c.description }).candidates[0]?.hscode ?? "";
      if (top.slice(0, 4) === c.expected4) heading++;
      if (top.slice(0, 2) === c.expected4.slice(0, 2)) chapter++;
    }
    console.log(`  144: heading ${heading}/${cases144.length}, chapter ${chapter}/${cases144.length}`);
    expect(heading / cases144.length).toBeGreaterThanOrEqual(0.75);
    expect(chapter / cases144.length).toBeGreaterThanOrEqual(0.85);
  });
});

describe("50 general questions", () => {
  it("never hits the table for chapters outside it", () => {
    const tableChapters = new Set(BUNDLED_LOOKUP.map((r) => r.c.slice(0, 2)));
    const outside = (cases50 as Case[]).filter((c) => !tableChapters.has(c.expected4.slice(0, 2)));
    const hits = outside
      .map((c) => ({ c, hit: lookup(c.description, tree) }))
      .filter((x) => x.hit && x.hit.score >= LOOKUP_THRESHOLD)
      .map((x) => `${x.c.description} -> ${x.hit!.row.c} ("${x.hit!.row.p}", ${x.hit!.score.toFixed(2)})`);
    console.log(`  outside the table: ${outside.length} questions, ${hits.length} hits`);
    expect(hits).toEqual([]);
  });

  it("gets at least as many right as the rules alone, with no new misses", () => {
    const newMisses: string[] = [];
    let correct4 = 0;
    for (const row of baseline50.rows) {
      const top = classify({ description: row.description }).candidates[0]?.hscode ?? "";
      const ok = top.slice(0, 4) === row.expected4;
      if (ok) correct4++;
      if (!ok && row.top?.slice(0, 4) === row.expected4) newMisses.push(`${row.description}: ${row.top} -> ${top}`);
    }
    console.log(`  50: ${correct4} (rules alone ${baseline50.correct4})`);
    expect(newMisses).toEqual([]);
    expect(correct4).toBeGreaterThanOrEqual(baseline50.correct4);
  });
});
