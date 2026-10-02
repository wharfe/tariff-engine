// compiler/build-lookup.ts
// Step 3 of the lookup table: keep phrases whose intended subheading Jev reproduced blind with heading
// confidence >= 0.8, drop anything close to a test question, and write data/lookup.json (bundled by src/lookup-data.ts).
//
// Usage: npx tsx compiler/build-lookup.ts

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { tokenize } from "../src/tokenizer.js";
import { stemSet } from "../src/stemmer.js";
import type { LookupRow } from "../src/lookup.js";
import { readJsonl } from "./jsonl.js";
import { testDescriptions, tooClose } from "./lookup-leak-check.js";
import type { Verified } from "./verify-phrases.js";

const MIN_HEADING_CONFIDENCE = 0.8;

function main() {
  const verified = readJsonl<Verified>(resolve("data/lookup-raw/verified.jsonl"));
  const tests = testDescriptions().map((d) => stemSet(tokenize(d)));

  const seen = new Set<string>();
  const rows: LookupRow[] = [];
  const perCode = new Map<string, { kept: number; mismatch: number; unsure: number; leak: number }>();
  const tally = (c: string) => {
    let t = perCode.get(c);
    if (!t) perCode.set(c, (t = { kept: 0, mismatch: 0, unsure: 0, leak: 0 }));
    return t;
  };

  for (const v of verified) {
    const id = `${v.c}\t${v.p.toLowerCase()}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const t = tally(v.c);
    if (v.js !== v.c) t.mismatch++;
    else if (v.hk < MIN_HEADING_CONFIDENCE) t.unsure++;
    else if (tests.some((s) => tooClose(stemSet(tokenize(v.p)), s))) t.leak++;
    else {
      t.kept++;
      rows.push({ p: v.p, c: v.c, k: Math.round(v.hk * 100) / 100 });
    }
  }
  rows.sort((a, b) => (a.c === b.c ? a.p.localeCompare(b.p) : a.c.localeCompare(b.c)));

  const json = JSON.stringify(rows);
  writeFileSync(resolve("data/lookup.json"), json + "\n");

  const totals = [...perCode.values()].reduce(
    (a, t) => ({ kept: a.kept + t.kept, mismatch: a.mismatch + t.mismatch, unsure: a.unsure + t.unsure, leak: a.leak + t.leak }),
    { kept: 0, mismatch: 0, unsure: 0, leak: 0 },
  );
  const empty = [...perCode].filter(([, t]) => t.kept === 0).map(([c]) => c);
  const summary = [
    "# 対応表の集計（compiler/build-lookup.ts が生成）",
    "",
    `- 検証済みの言い方: ${seen.size}`,
    `- 採用: ${totals.kept}（号 ${perCode.size - empty.length} / ${perCode.size}）`,
    `- 捨てた: Jev の号が違う ${totals.mismatch}、項の確信度 ${MIN_HEADING_CONFIDENCE} 未満 ${totals.unsure}、試験問題に近い ${totals.leak}`,
    `- data/lookup.json: ${(json.length / 1024 / 1024).toFixed(2)} MB`,
    "",
    `## 1 行も残らなかった号（${empty.length}）`,
    "",
    empty.join(", "),
    "",
  ].join("\n");
  writeFileSync(resolve("data/lookup-raw/summary.md"), summary);
  console.log(summary);
}

main();
