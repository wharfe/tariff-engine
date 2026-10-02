// compiler/tune-lookup-threshold.ts
// Pick LOOKUP_ALPHA and LOOKUP_THRESHOLD from tuning phrases only (never from the test questions).
// Two tuning styles, both written in runs separate from the table: long shop titles and short packing-list lines.
//   (a) phrases for chapters with no table rows -> any hit is wrong; must stay <= 0.5% in each style
//   (b) phrases for table chapters -> among hits, heading must be right >= 80%
// Among (alpha, threshold) pairs meeting both, take the one with the most correct (b) hits.
// Writes data/lookup-raw/threshold.md.
//
// Usage: npx tsx compiler/tune-lookup-threshold.ts

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadTree } from "../src/classifier.js";
import { lookup, type LookupRow } from "../src/lookup.js";
import { tokenize } from "../src/tokenizer.js";
import { stemSet } from "../src/stemmer.js";
import { readJsonl } from "./jsonl.js";
import { testDescriptions, tooClose } from "./lookup-leak-check.js";

const MAX_FALSE_HIT_RATE = 0.005;
const MIN_HIT_ACCURACY = 0.8;
const ALPHAS = [0, 0.1, 0.25, 0.5, 1];
const THRESHOLDS = Array.from({ length: 51 }, (_, i) => Math.round((0.5 + i * 0.01) * 100) / 100);

interface Phrase {
  c: string;
  p: string;
}

function main() {
  const tree = loadTree();
  const table = JSON.parse(readFileSync(resolve("data/lookup.json"), "utf-8")) as LookupRow[];
  const tableChapters = new Set(table.map((r) => r.c.slice(0, 2)));
  const tests = testDescriptions().map((d) => stemSet(tokenize(d)));
  const notTest = (t: Phrase) => {
    const s = stemSet(tokenize(t.p));
    return !tests.some((x) => tooClose(s, x));
  };
  const styles = {
    long: readJsonl<Phrase>(resolve("data/lookup-raw/tune-phrases.jsonl")).filter(notTest),
    short: readJsonl<Phrase>(resolve("data/lookup-raw/tune-short-phrases.jsonl")).filter(notTest),
  };
  const sets = Object.entries(styles).map(([name, all]) => ({
    name,
    outside: all.filter((t) => !tableChapters.has(t.c.slice(0, 2))),
    // Phrases close to a table row are kept: they come from a separate run, so closeness is how real input
    // behaves, not leakage. Removing them left only phrases the table cannot match (2026-10-02 run).
    inside: all.filter((t) => tableChapters.has(t.c.slice(0, 2))),
  }));

  interface Cell { alpha: number; th: number; ok: boolean; falseRates: number[]; hits: number; correct: number; acc: number }
  const cells: Cell[] = [];
  for (const alpha of ALPHAS) {
    const out = sets.map((s) => s.outside.map((t) => lookup(t.p, tree, alpha)?.score ?? 0));
    const ins = sets.flatMap((s) => s.inside.map((t) => ({ t, hit: lookup(t.p, tree, alpha) })));
    for (const th of THRESHOLDS) {
      const falseRates = out.map((xs) => xs.filter((x) => x >= th).length / Math.max(xs.length, 1));
      const hits = ins.filter((h) => h.hit && h.hit.score >= th);
      const correct = hits.filter((h) => h.hit!.row.c.slice(0, 4) === h.t.c.slice(0, 4)).length;
      const acc = hits.length ? correct / hits.length : 0;
      const ok = falseRates.every((r) => r <= MAX_FALSE_HIT_RATE) && hits.length > 0 && acc >= MIN_HIT_ACCURACY;
      cells.push({ alpha, th, ok, falseRates, hits: hits.length, correct, acc });
    }
  }
  const best = cells.filter((c) => c.ok).sort((a, b) => b.correct - a.correct || b.th - a.th)[0];
  const insideTotal = sets.reduce((n, s) => n + s.inside.length, 0);

  const row = (c: Cell) =>
    `| ${c.alpha} | ${c.th.toFixed(2)} | ${c.falseRates.map((r) => `${(r * 100).toFixed(1)}%`).join(" / ")} | ${((c.hits / insideTotal) * 100).toFixed(1)}% | ${(c.acc * 100).toFixed(0)}% | ${c.correct} |${c === best ? " **採用**" : ""}`;
  const md = [
    "# 重みと閾値の決め方（compiler/tune-lookup-threshold.ts が生成）",
    "",
    ...sets.map((s) => `- ${s.name === "long" ? "長い商品名" : "短い品名"}: 表の外 ${s.outside.length} 件 / 表の中 ${s.inside.length} 件`),
    `- 条件: 表の外の誤当たりがどちらの書き方でも ${MAX_FALSE_HIT_RATE * 100}% 以下、表の中で当たったうち項が正しい割合 ${MIN_HIT_ACCURACY * 100}% 以上。その中で正しく当たった数が最多の組を採る。`,
    best
      ? `- 採用: **重み ${best.alpha}・閾値 ${best.th.toFixed(2)}**（表の中で当たる割合 ${((best.hits / insideTotal) * 100).toFixed(1)}%、当たったうち項が正しい ${(best.acc * 100).toFixed(0)}%）`
      : "- **条件を満たす組が無い。報告が要る**",
    "",
    "| 重み | 閾値 | 表の外の誤当たり（長い / 短い） | 表の中で当たる割合 | 当たったうち項が正しい | 正しく当たった数 |",
    "|---|---|---|---|---|---|",
    ...ALPHAS.flatMap((a) => {
      const mine = cells.filter((c) => c.alpha === a);
      const okOnes = mine.filter((c) => c.ok);
      const pick = okOnes.sort((x, y) => y.correct - x.correct)[0] ?? mine.find((c) => c.th === 0.8)!;
      return [row(pick)];
    }),
    "",
  ].join("\n");
  writeFileSync(resolve("data/lookup-raw/threshold.md"), md);
  console.log(md);
}

main();
