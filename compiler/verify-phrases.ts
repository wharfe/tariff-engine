// compiler/verify-phrases.ts
// Step 2 of the lookup table: Jev classifies each generated phrase blind (chapter -> heading -> subheading),
// so only phrases whose intended code Jev independently reproduces end up in the table.
// Appends to data/lookup-raw/verified.jsonl keyed by (code, phrase); reruns skip finished pairs.
// The token budget counts what earlier runs already spent (summed from verified.jsonl).
//
// Usage: npx tsx compiler/verify-phrases.ts <phrases.jsonl> [--parallel 8] [--budget 150000000]

import { appendFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { HsNode } from "../src/types.js";
import { choose, runTokens, spentTokens } from "./jev-client.js";
import { endWithNewline, readJsonl } from "./jsonl.js";

const OUT = resolve("data/lookup-raw/verified.jsonl");

export interface Verified {
  c: string; // intended subheading
  p: string; // phrase
  jc: string; // Jev chapter
  jh: string; // Jev heading
  js: string; // Jev subheading
  hk: number; // Jev heading confidence
  sk: number; // Jev subheading confidence
  t: number; // input tokens billed
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const key = (code: string) => `c${code}`;
const unkey = (k: string) => k.slice(1);
const criteria = (nodes: HsNode[]) => Object.fromEntries(nodes.map((n) => [key(n.code), `${n.code}: ${n.description}`]));

async function classify(tree: HsNode[], phrase: string): Promise<Omit<Verified, "c" | "p">> {
  let t = 0;
  const step = async (instructions: string, nodes: HsNode[]) => {
    if (nodes.length === 1) return { code: nodes[0].code, confidence: 1 };
    const r = await choose(phrase, instructions, criteria(nodes));
    t += r.inputTokens;
    return { code: unkey(r.answer.choice), confidence: r.answer.confidence };
  };
  const ch = await step(
    "Which Harmonized System (HS 2022) chapter classifies this traded product? Apply the General Interpretative Rules.",
    tree,
  );
  const chNode = tree.find((n) => n.code === ch.code)!;
  const hd = await step(`Which 4-digit HS heading within chapter ${chNode.code} classifies this product?`, chNode.children);
  const hdNode = chNode.children.find((n) => n.code === hd.code)!;
  const sb = await step(`Which 6-digit HS subheading within heading ${hdNode.code} classifies this product?`, hdNode.children);
  return { jc: ch.code, jh: hd.code, js: sb.code, hk: hd.confidence, sk: sb.confidence, t };
}

async function main() {
  const inFile = process.argv[2];
  if (!inFile) throw new Error("usage: verify-phrases.ts <phrases.jsonl> [--parallel 8] [--budget N]");
  const tree = JSON.parse(readFileSync(resolve("data/hs-tree.json"), "utf-8")) as HsNode[];
  endWithNewline(OUT);
  const prior = readJsonl<Verified>(OUT);
  const done = new Set(prior.map((v) => `${v.c}\t${v.p}`));
  const before = spentTokens();
  let spent = before;
  const budget = Number(arg("--budget") ?? 150_000_000);
  const todo = readJsonl<{ c: string; p: string }>(inFile).filter((r) => !done.has(`${r.c}\t${r.p}`));
  console.log(`${done.size} verified, ${todo.length} to go, ${spent.toLocaleString("en-US")} tokens spent so far`);

  let next = 0;
  let errors = 0;
  let stopped = false;
  const worker = async () => {
    while (next < todo.length && !stopped) {
      if (spent >= budget) {
        stopped = true;
        break;
      }
      const row = todo[next++];
      try {
        const v: Verified = { c: row.c, p: row.p, ...(await classify(tree, row.p)) };
        spent = before + runTokens();
        appendFileSync(OUT, JSON.stringify(v) + "\n");
      } catch (e) {
        if (++errors >= 10) stopped = true;
        console.error(`  error on "${row.p}": ${String(e).slice(0, 200)}`);
      }
      if (next % 500 === 0) console.log(`  ${next}/${todo.length}, ${spent.toLocaleString("en-US")} tokens`);
    }
  };
  await Promise.all(Array.from({ length: Number(arg("--parallel") ?? 8) }, worker));
  console.log(`done: ${spent.toLocaleString("en-US")} tokens total, ${errors} errors${spent >= budget ? ", BUDGET REACHED" : ""}`);
  if (stopped) process.exit(1);
}

main().catch((e) => {
  console.error(String(e));
  process.exit(1);
});
