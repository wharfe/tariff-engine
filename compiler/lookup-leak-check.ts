// compiler/lookup-leak-check.ts
// Drop generated phrases that are near-copies of any test question, so the lookup table cannot
// score by memorising the evaluation set. Similarity = Jaccard over stemmed tokens.
//
// Usage: npx tsx compiler/lookup-leak-check.ts <in.jsonl> <out.jsonl>
// Lines are JSON objects with a "p" (phrase) field; other fields pass through untouched.

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { tokenize } from "../src/tokenizer.js";
import { stemSet } from "../src/stemmer.js";

export const DROP_AT = 0.6;
export const OVERLAP_DROP_AT = 0.8;
const REPORT_FROM = 0.5;

/** Every product description that appears in any test file. */
export function testDescriptions(): string[] {
  const out: string[] = [];
  const fixtures = resolve("tests/fixtures");
  for (const f of readdirSync(fixtures).filter((f) => f.endsWith(".json"))) {
    const data = JSON.parse(readFileSync(resolve(fixtures, f), "utf-8")) as
      | { description: string }[]
      | { rows: { description: string }[] };
    for (const c of Array.isArray(data) ? data : data.rows) out.push(c.description);
  }
  // JSON-style entries in the verified hard set
  for (const m of readFileSync(resolve("tests/hard-20-verified.md"), "utf-8").matchAll(/"description":\s*"([^"]+)"/g)) {
    out.push(m[1]);
  }
  // Quoted cases in the draft list: 1. **素直** "frozen chicken thighs" → ...
  for (const m of readFileSync(resolve("tests/fixtures/test-cases-draft.md"), "utf-8").matchAll(/\*\*\s*"([^"]+)"/g)) {
    out.push(m[1]);
  }
  return [...new Set(out)];
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let common = 0;
  for (const x of a) if (b.has(x)) common++;
  return common / (a.size + b.size - common);
}

/** Share of the shorter set's words found in the other (catches "cotton t-shirt" vs "cotton t-shirt, men's, knitted"). */
export function overlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let common = 0;
  for (const x of a) if (b.has(x)) common++;
  return common / Math.min(a.size, b.size);
}

/** True when two texts are close enough that one could stand in for the other. */
export function tooClose(a: Set<string>, b: Set<string>): boolean {
  return jaccard(a, b) >= DROP_AT || overlap(a, b) >= OVERLAP_DROP_AT;
}

function main() {
  const [inFile, outFile] = process.argv.slice(2);
  if (!inFile || !outFile) throw new Error("usage: lookup-leak-check.ts <in.jsonl> <out.jsonl>");
  const tests = testDescriptions().map((d) => ({ d, s: stemSet(tokenize(d)) }));
  const kept: string[] = [];
  const dropped: string[] = [];
  let near = 0;
  for (const line of readFileSync(inFile, "utf-8").split("\n").filter(Boolean)) {
    let row: { p: string };
    try {
      row = JSON.parse(line) as { p: string };
    } catch {
      continue; // torn line from an interrupted run
    }
    const s = stemSet(tokenize(row.p));
    let best = 0;
    let bestDesc = "";
    let close = "";
    for (const t of tests) {
      const j = jaccard(s, t.s);
      if (j > best) [best, bestDesc] = [j, t.d];
      if (!close && tooClose(s, t.s)) close = t.d;
    }
    if (close) dropped.push(`${row.p}  ~  ${close}`);
    else {
      if (best >= REPORT_FROM) near++;
      kept.push(line);
    }
  }
  writeFileSync(outFile, kept.length ? kept.join("\n") + "\n" : "");
  console.log(`test descriptions: ${tests.length}`);
  console.log(`kept ${kept.length}, dropped ${dropped.length} (jaccard >= ${DROP_AT} or overlap >= ${OVERLAP_DROP_AT}), near ${near} (jaccard ${REPORT_FROM}-${DROP_AT})`);
  for (const d of dropped.slice(0, 20)) console.log(`  dropped: ${d}`);
}

if (process.argv[1]?.endsWith("lookup-leak-check.ts")) main();
