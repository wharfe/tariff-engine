// experiments/decision-models/report.ts
// Usage: npx tsx experiments/decision-models/report.ts <results-dir>  -> prints a Markdown table and writes report.md

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { PRICE_PER_MTOK, type ModelName } from "./backends.js";
import type { CaseResult } from "./run.js";

const AUTO_THRESHOLD = 0.8;

const pct = (n: number, d: number) => (d === 0 ? "—" : `${Math.round((n / d) * 100)}%`);

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

function row(name: string, rs: CaseResult[]): string {
  const n = rs.length;
  const chapter = rs.filter((r) => r.chapter !== undefined && r.expected4.startsWith(r.chapter)).length;
  const top1 = rs.filter((r) => r.headings[0] === r.expected4).length;
  const top3 = rs.filter((r) => r.headings.slice(0, 3).includes(r.expected4)).length;
  const six = rs.filter((r) => r.subheading === r.expected6).length;
  const auto = rs.filter((r) => (r.headingConfidence ?? 0) >= AUTO_THRESHOLD);
  const autoOk = auto.filter((r) => r.headings[0] === r.expected4).length;
  const tokens = rs.reduce((s, r) => s + r.inputTokens, 0);
  const model = name.replace(/-(single|rerank)$/, "") as ModelName;
  const usd = ((PRICE_PER_MTOK[model] ?? 0) * tokens) / 1e6;
  const hasChapter = rs.some((r) => r.chapter !== undefined);
  const hasSix = rs.some((r) => r.subheading !== undefined);
  const refused = rs.filter((r) => r.error).length;
  return [
    name,
    refused ? `${n}（うち答えられず ${refused}）` : n,
    hasChapter ? pct(chapter, n) : "—",
    pct(top1, n),
    pct(top3, n),
    hasSix ? pct(six, n) : "—",
    `${pct(auto.length, n)} / ${pct(autoOk, auto.length)}`,
    tokens.toLocaleString("en-US"),
    usd ? `$${usd.toFixed(3)}` : "—",
    `${Math.round(median(rs.map((r) => r.ms)))}ms`,
  ].join(" | ");
}

const dir = process.argv[2];
if (!dir) throw new Error("usage: report.ts <results-dir>");
const files = readdirSync(dir).filter((f) => f.endsWith(".jsonl")).sort();
const lines = [
  `| 実行 | 件数 | 章 | 項 1 位 | 項 上位 3 | 号 | 確信度 ${AUTO_THRESHOLD} 以上の割合 / その正解率 | 入力トークン | 費用 | 1 問の時間（中央値） |`,
  "|---|---|---|---|---|---|---|---|---|---|",
  ...files.map((f) =>
    row(
      basename(f, ".jsonl"),
      readFileSync(join(dir, f), "utf-8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l) as CaseResult),
    ),
  ),
].map((l) => (l.startsWith("|") ? l : `| ${l} |`));

// rerank upper bound: how often the engine's own top-10 even contains the answer
const rerankFile = files.find((f) => f.endsWith("-rerank.jsonl"));
if (rerankFile) {
  const rs = readFileSync(join(dir, rerankFile), "utf-8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l) as CaseResult);
  lines.push("", `ルールの上位 10 件に正解が入っている割合（候補から選ばせる方式の上限）: ${pct(rs.filter((r) => r.candidatesContainExpected).length, rs.length)}`);
}

const md = lines.join("\n");
console.log(md);
writeFileSync(join(dir, "report.md"), md + "\n");
