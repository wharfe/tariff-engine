// experiments/decision-models/run.ts
// Usage: npx tsx experiments/decision-models/run.ts <model|baseline> <single|rerank> [--limit N] [--out DIR]
// Appends one JSON line per case to <out>/<model>-<mode>.jsonl and skips cases already there (resumable).

import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { classify, loadTree } from "../../src/classifier.js";
import type { HsNode } from "../../src/types.js";
import { ask, MODELS, type ChoiceAnswer, type ModelName } from "./backends.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

interface Case {
  description: string;
  expected4: string;
  expected6: string;
}

export interface CaseResult {
  description: string;
  expected4: string;
  expected6: string;
  chapter?: string;
  chapterConfidence?: number;
  headings: string[]; // ranked 4-digit codes, best first
  headingConfidence?: number;
  subheading?: string;
  candidatesContainExpected?: boolean; // rerank mode only
  inputTokens: number;
  ms: number;
  error?: string;
}

function loadCases(): Case[] {
  const dir = join(ROOT, "tests/fixtures");
  return readdirSync(dir)
    .filter((f) => /^chapter-\d+-cases\.json$/.test(f))
    .sort()
    .flatMap((f) => JSON.parse(readFileSync(join(dir, f), "utf-8")) as Case[]);
}

// Choice keys are prefixed so every key is a plain identifier, whatever the backend expects.
const key = (code: string) => `c${code}`;
const unkey = (k: string) => k.slice(1);

function criteria(nodes: HsNode[]): Record<string, string> {
  return Object.fromEntries(nodes.map((n) => [key(n.code), `${n.code}: ${n.description}`]));
}

function onlyOption(code: string): ChoiceAnswer {
  return { type: "choice", choice: key(code), probabilities: { [key(code)]: 1 }, confidence: 1 };
}

function ranked(a: ChoiceAnswer): string[] {
  return Object.entries(a.probabilities)
    .sort((x, y) => y[1] - x[1])
    .map(([k]) => unkey(k));
}

async function single(model: ModelName, tree: HsNode[], c: Case): Promise<CaseResult> {
  let inputTokens = 0;
  let ms = 0;
  const step = async (instructions: string, nodes: HsNode[]): Promise<ChoiceAnswer> => {
    // Clef rejects a choice with fewer than 2 options; a single option needs no decision anyway.
    if (nodes.length === 1) return onlyOption(nodes[0].code);
    const r = await ask(model, c.description, { q: { type: "choice", instructions, criteria: criteria(nodes) } });
    inputTokens += r.inputTokens;
    ms += r.ms;
    return r.answers.q;
  };

  const ch = await step(
    "Which Harmonized System (HS 2022) chapter classifies this traded product? Apply the General Interpretative Rules.",
    tree,
  );
  const chapterNode = tree.find((n) => n.code === unkey(ch.choice))!;
  const hd = await step(
    `Which 4-digit HS heading within chapter ${chapterNode.code} classifies this product?`,
    chapterNode.children,
  );
  const headingNode = chapterNode.children.find((n) => n.code === unkey(hd.choice))!;
  const sub = await step(
    `Which 6-digit HS subheading within heading ${headingNode.code} classifies this product?`,
    headingNode.children,
  );
  return {
    ...c,
    chapter: chapterNode.code,
    chapterConfidence: ch.confidence,
    headings: ranked(hd),
    headingConfidence: hd.confidence,
    subheading: unkey(sub.choice),
    inputTokens,
    ms,
  };
}

async function rerank(model: ModelName, tree: HsNode[], c: Case): Promise<CaseResult> {
  const heads = new Map(tree.flatMap((ch) => ch.children).map((h) => [h.code, h]));
  const codes = [...new Set(classify({ description: c.description }).candidates.map((x) => x.hscode.slice(0, 4)))].slice(0, 10);
  const nodes = codes.map((code) => heads.get(code)).filter((n): n is HsNode => !!n);
  if (nodes.length === 0) return { ...c, headings: [], inputTokens: 0, ms: 0, candidatesContainExpected: false };
  if (nodes.length === 1) {
    return { ...c, headings: [nodes[0].code], headingConfidence: 1, candidatesContainExpected: codes.includes(c.expected4), inputTokens: 0, ms: 0 };
  }
  const r = await ask(model, c.description, {
    q: {
      type: "choice",
      instructions: "Which 4-digit HS 2022 heading classifies this traded product? Apply the General Interpretative Rules.",
      criteria: criteria(nodes),
    },
  });
  return {
    ...c,
    headings: ranked(r.answers.q),
    headingConfidence: r.answers.q.confidence,
    candidatesContainExpected: codes.includes(c.expected4),
    inputTokens: r.inputTokens,
    ms: r.ms,
  };
}

function baseline(c: Case): CaseResult {
  const started = performance.now();
  const cands = classify({ description: c.description }).candidates;
  return {
    ...c,
    chapter: cands[0]?.hscode.slice(0, 2),
    headings: [...new Set(cands.map((x) => x.hscode.slice(0, 4)))],
    headingConfidence: cands[0]?.confidence,
    subheading: cands[0]?.hscode,
    inputTokens: 0,
    ms: performance.now() - started,
  };
}

async function main() {
  const [modelArg, mode = "single", ...rest] = process.argv.slice(2);
  const opt = (name: string) => {
    const i = rest.indexOf(name);
    return i >= 0 ? rest[i + 1] : undefined;
  };
  if (modelArg !== "baseline" && !MODELS.includes(modelArg as ModelName)) {
    throw new Error(`model must be baseline or one of ${MODELS.join(", ")}`);
  }
  if (mode !== "single" && mode !== "rerank") throw new Error("mode must be single or rerank");

  const tree = loadTree();
  const cases = loadCases().slice(0, Number(opt("--limit") ?? Infinity));
  const outDir = opt("--out") ?? join(ROOT, "experiments/decision-models/results", new Date().toISOString().slice(0, 10));
  mkdirSync(outDir, { recursive: true });
  const outFile = join(outDir, `${modelArg === "baseline" ? "baseline" : `${modelArg}-${mode}`}.jsonl`);
  const done = new Set(
    existsSync(outFile)
      ? readFileSync(outFile, "utf-8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l).description as string)
      : [],
  );

  const todo = cases.filter((c) => !done.has(c.description));
  console.log(`${outFile}: ${done.size} done, ${todo.length} to go`);
  let errors = 0;
  // Sequential on purpose: latency numbers stay comparable and no backend gets rate limited.
  for (const c of todo) {
    let r: CaseResult;
    try {
      r =
        modelArg === "baseline"
          ? baseline(c)
          : await (mode === "single" ? single : rerank)(modelArg as ModelName, tree, c);
    } catch (e) {
      // 422 = the model deterministically refuses this input (e.g. Decider's context cannot hold the options).
      // Record it as an unanswered case so it counts as wrong instead of retrying forever.
      if (/HTTP 422/.test(String(e))) {
        appendFileSync(outFile, JSON.stringify({ ...c, headings: [], inputTokens: 0, ms: 0, error: String(e).slice(0, 200) }) + "\n");
        continue;
      }
      errors++;
      console.error(`  error on "${c.description}": ${String(e)}`);
      if (errors >= 5) throw new Error("5 errors, stopping (fix and rerun; finished cases are kept)");
      continue; // not written, so a rerun retries it
    }
    appendFileSync(outFile, JSON.stringify(r) + "\n");
  }
  console.log(`finished: ${todo.length - errors} written, ${errors} errors`);
}

main().catch((e) => {
  console.error(String(e));
  process.exit(1);
});
