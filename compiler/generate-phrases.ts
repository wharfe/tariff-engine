// compiler/generate-phrases.ts
// Step 1 of the lookup table: have Claude write realistic product phrases for each 6-digit subheading.
// Runs `claude -p` in an empty temp dir so no repo context (README examples, test fixtures) can leak in.
// Appends to data/lookup-raw/phrases.jsonl; subheadings already present are skipped (resumable).
//
// Usage: npx tsx compiler/generate-phrases.ts [--chapters 30,33] [--parallel 4]
//        npx tsx compiler/generate-phrases.ts --purpose tune [--parallel 4]
//   tune: a separate run with a different (retail-listing) instruction, 1 phrase per subheading for all
//   97 chapters, written to tune-phrases.jsonl. Used only to pick the lookup threshold, never put in the table.
//        npx tsx compiler/generate-phrases.ts --purpose tune-short   (same, short packing-list style -> tune-short-phrases.jsonl)

import { execFile } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import type { HsNode } from "../src/types.js";
import { endWithNewline } from "./jsonl.js";

const run = promisify(execFile);
const PURPOSE = process.argv.includes("--purpose") ? process.argv[process.argv.indexOf("--purpose") + 1] : "table";
const TUNE = PURPOSE === "tune" || PURPOSE === "tune-short";
const SHORT = PURPOSE === "tune-short";
const OUT = resolve(SHORT ? "data/lookup-raw/tune-short-phrases.jsonl" : TUNE ? "data/lookup-raw/tune-phrases.jsonl" : "data/lookup-raw/phrases.jsonl");
const FAILED = resolve(SHORT ? "data/lookup-raw/tune-short-failed.jsonl" : TUNE ? "data/lookup-raw/tune-failed.jsonl" : "data/lookup-raw/phrases-failed.jsonl");
const BATCH_SIZE = TUNE ? 40 : 20;
const PER_CODE = TUNE ? 1 : 10;
const DONE_AT = TUNE ? 1 : 8;

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function targetChapters(): string[] {
  if (TUNE) return Array.from({ length: 97 }, (_, i) => String(i + 1).padStart(2, "0"));
  const given = arg("--chapters");
  if (given) return given.split(",").map((s) => s.trim());
  const chapters: string[] = [];
  for (let i = 1; i <= 97; i++) {
    const code = String(i).padStart(2, "0");
    if (existsSync(resolve(`data/rules/chapter-${code}.json`))) chapters.push(code);
  }
  return chapters;
}

interface Target {
  code: string;
  line: string; // "chapter > heading > subheading" context for the prompt
}

function prompt(batch: Target[]): string {
  if (SHORT) {
    return `You write item lines for warehouse packing lists and shipping manifests.

For EACH 6-digit HS subheading below, write ONE packing-list item line for a concrete item that belongs to it.
- 2 to 5 words, plain wording a warehouse clerk would type. No brand names.
- Do NOT copy the subheading wording.
- English only.

Output ONLY a JSON object: { "<6-digit code>": ["item line"], ... } with every code below as a key.

${batch.map((t) => `${t.code}: ${t.line}`).join("\n")}`;
  }
  if (TUNE) {
    return `You write product titles the way online shops and marketplaces list them.

For EACH 6-digit HS subheading below, write ONE product title for a concrete item that belongs to it.
- Write it as a shop listing title: it may include a brand-like adjective, size, colour, quantity or material.
- Do NOT copy the subheading wording.
- English only.

Output ONLY a JSON object: { "<6-digit code>": ["title"], ... } with every code below as a key.

${batch.map((t) => `${t.code}: ${t.line}`).join("\n")}`;
  }
  return `You write realistic product descriptions as they appear on commercial invoices, customs declarations and e-commerce listings.

For EACH 6-digit HS subheading below, write ${PER_CODE} different product descriptions of goods that belong to it.
- Mostly short (2-8 words, like an invoice line); a few may add specs such as size, material or power.
- Vary vocabulary: everyday names, trade names, material + product, use + product.
- Do NOT copy the subheading wording; describe concrete goods a seller would list.
- English only.

Output ONLY a JSON object: { "<6-digit code>": ["description", ...], ... } with every code below as a key.

${batch.map((t) => `${t.code}: ${t.line}`).join("\n")}`;
}

async function generate(batch: Target[], cwd: string): Promise<Record<string, string[]>> {
  const { stdout } = await run(
    "claude",
    ["-p", prompt(batch), "--setting-sources", "", "--tools", "", "--model", "sonnet"],
    { cwd, timeout: 600_000, maxBuffer: 16 * 1024 * 1024 },
  );
  const json = stdout.slice(stdout.indexOf("{"), stdout.lastIndexOf("}") + 1);
  return JSON.parse(json) as Record<string, string[]>;
}

async function main() {
  const tree = JSON.parse(readFileSync(resolve("data/hs-tree.json"), "utf-8")) as HsNode[];
  mkdirSync(resolve("data/lookup-raw"), { recursive: true });
  endWithNewline(OUT);
  // A subheading counts as done once it has most of its phrases; a torn or partial batch is regenerated.
  const perCode = new Map<string, number>();
  if (existsSync(OUT)) {
    for (const l of readFileSync(OUT, "utf-8").split("\n")) {
      try {
        const c = (JSON.parse(l) as { c: string }).c;
        perCode.set(c, (perCode.get(c) ?? 0) + 1);
      } catch {
        // empty or torn line
      }
    }
  }
  const done = new Set([...perCode].filter(([, n]) => n >= DONE_AT).map(([c]) => c));

  const targets: Target[] = [];
  for (const ch of tree.filter((c) => targetChapters().includes(c.code))) {
    for (const h of ch.children) {
      for (const s of h.children) {
        if (!done.has(s.code)) {
          targets.push({ code: s.code, line: `${ch.description} > ${h.description} > ${s.description}` });
        }
      }
    }
  }
  const batches: Target[][] = [];
  for (let i = 0; i < targets.length; i += BATCH_SIZE) batches.push(targets.slice(i, i + BATCH_SIZE));
  console.log(`${done.size} subheadings done, ${targets.length} to go in ${batches.length} batches`);

  const cwd = mkdtempSync(join(tmpdir(), "tariff-phrases-"));
  const parallel = Number(arg("--parallel") ?? 4);
  let next = 0;
  let failed = 0;
  const worker = async () => {
    while (next < batches.length) {
      const batch = batches[next++];
      let result: Record<string, string[]> | undefined;
      for (let attempt = 1; attempt <= 2 && !result; attempt++) {
        try {
          result = await generate(batch, cwd);
        } catch (e) {
          if (attempt === 2) {
            failed++;
            appendFileSync(FAILED, JSON.stringify({ codes: batch.map((t) => t.code), error: String(e).slice(0, 300) }) + "\n");
          }
        }
      }
      if (!result) continue;
      // One line per (code, phrase); only codes that were asked for, deduplicated.
      const lines: string[] = [];
      for (const t of batch) {
        for (const p of new Set((result[t.code] ?? []).map((s) => s.trim()).filter(Boolean))) {
          lines.push(JSON.stringify({ c: t.code, p }));
        }
      }
      if (lines.length) appendFileSync(OUT, lines.join("\n") + "\n");
      console.log(`batch ${batch[0].code}..${batch[batch.length - 1].code}: ${lines.length} phrases`);
    }
  };
  await Promise.all(Array.from({ length: parallel }, worker));
  console.log(`finished; ${failed} batches failed (see ${FAILED})`);
}

main().catch((e) => {
  console.error(String(e));
  process.exit(1);
});
