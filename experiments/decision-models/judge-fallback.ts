// experiments/decision-models/judge-fallback.ts
// One-shot judgement of classifyWithDecider(jevDecider) against rules only, on the held-out CROSS set
// (pass lines in docs/superpowers/specs/2026-10-03-jev-fallback.md). Reference rows for the 50 / 144 sets
// are reported but never decide anything. Results go to results/2026-10-03-fallback/.
//
// Usage: npx tsx experiments/decision-models/judge-fallback.ts

import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { classify, loadTree } from "../../src/classifier.js";
import { classifyWithDecider } from "../../src/classify-with-decider.js";
import { jevDecider } from "../../src/jev.js";
import type { ClassifyWithDeciderResult } from "../../src/decider.js";

interface Case {
  description: string;
  expected4: string;
  expected6: string;
  ambiguous?: boolean;
}

interface Row extends Case {
  set: string;
  rules4: string;
  rules6: string;
  with4: string;
  with6: string;
  needsReview: boolean;
  decider: ClassifyWithDeciderResult["decider"];
}

const OUT = resolve("experiments/decision-models/results/2026-10-03-fallback");

function sets(): Record<string, Case[]> {
  const fixtures = resolve("tests/fixtures");
  return {
    cross: JSON.parse(readFileSync(join(fixtures, "cross-2026h2.json"), "utf-8")) as Case[],
    "ref-50": JSON.parse(readFileSync(join(fixtures, "test-cases.json"), "utf-8")) as Case[],
    "ref-144": readdirSync(fixtures)
      .filter((f) => /^chapter-\d+-cases\.json$/.test(f))
      .sort()
      .flatMap((f) => JSON.parse(readFileSync(join(fixtures, f), "utf-8")) as Case[]),
  };
}

/** Two-sided exact McNemar p-value from discordant counts. */
function mcnemar(b: number, c: number): number {
  const n = b + c;
  if (n === 0) return 1;
  const k = Math.min(b, c);
  let p = 0;
  let coef = 1; // C(n, 0)
  for (let i = 0; i <= k; i++) {
    if (i > 0) coef = (coef * (n - i + 1)) / i;
    p += coef / 2 ** n;
  }
  return Math.min(1, 2 * p);
}

function wilsonLower(ok: number, n: number, z = 1.96): number {
  if (n === 0) return 0;
  const p = ok / n;
  const d = 1 + (z * z) / n;
  return (p + (z * z) / (2 * n) - z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
}

function summarize(name: string, rows: Row[]) {
  const n = rows.length;
  const r4 = rows.filter((r) => r.rules4 === r.expected4).length;
  const w4 = rows.filter((r) => r.with4 === r.expected4).length;
  const onlyWith = rows.filter((r) => r.with4 === r.expected4 && r.rules4 !== r.expected4).length;
  const onlyRules = rows.filter((r) => r.rules4 === r.expected4 && r.with4 !== r.expected4).length;
  const trusted = rows.filter((r) => r.decider.used && !r.needsReview);
  const trusted6 = trusted.filter((r) => r.with6 === r.expected6).length;
  const failed = rows.filter((r) => r.decider.error && !r.decider.error.startsWith("low confidence")).length;
  return {
    name,
    n,
    rules4: r4 / n,
    with4: w4 / n,
    gain: (w4 - r4) / n,
    p: mcnemar(onlyWith, onlyRules),
    asked: rows.filter((r) => r.decider.asked).length,
    used: rows.filter((r) => r.decider.used).length,
    trusted: trusted.length,
    trusted6: trusted.length ? trusted6 / trusted.length : 0,
    trustedLower: wilsonLower(trusted6, trusted.length),
    failed,
    rules6: rows.filter((r) => r.rules6 === r.expected6).length / n,
    with6: rows.filter((r) => r.with6 === r.expected6).length / n,
  };
}

async function main() {
  loadTree();
  const apiKey = readFileSync(join(homedir(), ".config/typesafe/api-key"), "utf-8").trim();
  const decider = jevDecider({ apiKey });
  mkdirSync(OUT, { recursive: true });

  const all: Row[] = [];
  for (const [set, cases] of Object.entries(sets())) {
    const file = join(OUT, `${set}.jsonl`);
    const done = new Map(
      existsSync(file)
        ? readFileSync(file, "utf-8").trim().split("\n").filter(Boolean).map((l) => [(JSON.parse(l) as Row).description, JSON.parse(l) as Row])
        : [],
    );
    for (const c of cases) {
      let row = done.get(c.description);
      if (!row) {
        const rules = classify({ description: c.description }).candidates[0]?.hscode ?? "";
        const w = await classifyWithDecider({ description: c.description }, { decider });
        const top = w.candidates[0]?.hscode ?? "";
        row = { ...c, set, rules4: rules.slice(0, 4), rules6: rules, with4: top.slice(0, 4), with6: top, needsReview: w.needs_review, decider: w.decider };
        appendFileSync(file, JSON.stringify(row) + "\n");
      }
      all.push(row);
    }
    console.log(`${set}: ${cases.length} done`);
  }

  const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
  const cross = all.filter((r) => r.set === "cross");
  const summaries = [
    summarize("判定: CROSS 全体", cross),
    summarize("参考: CROSS 印なし", cross.filter((r) => !r.ambiguous)),
    summarize("参考: 50 問（ルール調整に使用済み）", all.filter((r) => r.set === "ref-50")),
    summarize("参考: 144 問（線の調整に使用済み）", all.filter((r) => r.set === "ref-144")),
  ];
  const head = "| 集合 | 件数 | 項 1 位: ルールだけ | 項 1 位: Jev あり | 差 | McNemar p（両側） | 聞いた | 採った | 要確認なし（割合） | 要確認なしの 6 桁正解率 / Wilson 下限 | 時間切れ・失敗 | 6 桁: ルール / Jev あり |";
  const lines = [head, "|---|---|---|---|---|---|---|---|---|---|---|---|"].concat(
    summaries.map(
      (s) =>
        `| ${s.name} | ${s.n} | ${pct(s.rules4)} | ${pct(s.with4)} | ${s.gain >= 0 ? "+" : ""}${(s.gain * 100).toFixed(1)} | ${s.p.toExponential(1)} | ${s.asked} | ${s.used} | ${s.trusted}（${pct(s.trusted / s.n)}） | ${pct(s.trusted6)} / ${s.trustedLower.toFixed(3)} | ${s.failed}（${pct(s.failed / s.n)}） | ${pct(s.rules6)} / ${pct(s.with6)} |`,
    ),
  );
  const j = summaries[0];
  const gates = [
    ["1. 項の 1 位がルールだけより 10 ポイント以上高い", j.gain >= 0.1],
    ["2. McNemar 両側 p < 0.05", j.p < 0.05],
    ["3a. 要確認なしが 25% 以上", j.trusted / j.n >= 0.25],
    ["3b. 要確認なしの 6 桁正解率の Wilson 下限 ≥ 0.85", j.trustedLower >= 0.85],
    ["無効判定: 時間切れ・失敗が 5% 以下", j.failed / j.n <= 0.05],
  ] as const;
  const md = [
    "# 判定（1 回だけ）: 迷った時に Jev に聞く",
    "",
    ...lines,
    "",
    ...gates.map(([label, ok]) => `- ${ok ? "合格" : "**不合格**"}: ${label}`),
    "",
  ].join("\n");
  writeFileSync(join(OUT, "report.md"), md);
  console.log(md);
}

main().catch((e) => {
  console.error(String(e).slice(0, 200));
  process.exit(1);
});
