// experiments/decision-models/ceiling-claude.ts
// Ceiling check: can a strong general model (Claude via `claude -p`) classify the CROSS subjects much better
// than Jev did? If not, the subject text itself lacks the facts that decide the code.
// Runs in an empty temp dir (no repo context), 20 subjects per call, resumable.
// Writes results/2026-10-03-ceiling/claude-<model>.jsonl and prints a summary.
//
// Usage: npx tsx experiments/decision-models/ceiling-claude.ts [--model sonnet] [--parallel 4]

import { execFile } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

interface Case {
  description: string;
  expected4: string;
  expected6: string;
  ruling: string;
}

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

function prompt(batch: Case[]): string {
  return `You are a customs classification expert. For each product below, give the 6-digit Harmonized System (HS 2022) subheading it is most likely classified under. Use only the text given; if facts are missing, pick the most likely code.

Output ONLY a JSON object mapping each id to a 6-digit code string, e.g. {"1": "330610"}.

${batch.map((c, i) => `${i + 1}: ${c.description}`).join("\n")}`;
}

async function main() {
  const model = arg("--model", "sonnet");
  const cases = JSON.parse(readFileSync(resolve("tests/fixtures/cross-2026h2.json"), "utf-8")) as Case[];
  const outDir = resolve("experiments/decision-models/results/2026-10-03-ceiling");
  mkdirSync(outDir, { recursive: true });
  const out = join(outDir, `claude-${model}.jsonl`);
  const done = new Set(
    existsSync(out) ? readFileSync(out, "utf-8").trim().split("\n").filter(Boolean).map((l) => (JSON.parse(l) as { ruling: string }).ruling) : [],
  );
  const todo = cases.filter((c) => !done.has(c.ruling));
  const batches: Case[][] = [];
  for (let i = 0; i < todo.length; i += 20) batches.push(todo.slice(i, i + 20));
  const cwd = mkdtempSync(join(tmpdir(), "tariff-ceiling-"));

  let next = 0;
  const worker = async () => {
    while (next < batches.length) {
      const batch = batches[next++];
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const { stdout } = await run("claude", ["-p", prompt(batch), "--setting-sources", "", "--tools", "", "--model", model], {
            cwd,
            timeout: 600_000,
            maxBuffer: 16 * 1024 * 1024,
          });
          const answers = JSON.parse(stdout.slice(stdout.indexOf("{"), stdout.lastIndexOf("}") + 1)) as Record<string, string>;
          const lines = batch.map((c, i) => JSON.stringify({ ...c, answer: String(answers[String(i + 1)] ?? "").replace(/\D/g, "").slice(0, 6) }));
          appendFileSync(out, lines.join("\n") + "\n");
          break;
        } catch (e) {
          if (attempt === 2) console.error(`batch failed: ${String(e).slice(0, 120)}`);
        }
      }
    }
  };
  await Promise.all(Array.from({ length: Number(arg("--parallel", "4")) }, worker));

  const rows = readFileSync(out, "utf-8").trim().split("\n").map((l) => JSON.parse(l) as Case & { answer: string });
  const n = rows.length;
  const ch = rows.filter((r) => r.answer.slice(0, 2) === r.expected4.slice(0, 2)).length;
  const hd = rows.filter((r) => r.answer.slice(0, 4) === r.expected4).length;
  const sb = rows.filter((r) => r.answer === r.expected6).length;
  const pct = (x: number) => `${((x / n) * 100).toFixed(1)}%`;
  console.log(`claude-${model}: ${n} 問  章 ${pct(ch)}  項 ${pct(hd)}  号 ${pct(sb)}`);
}

main().catch((e) => {
  console.error(String(e).slice(0, 200));
  process.exit(1);
});
