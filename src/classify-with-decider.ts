// src/classify-with-decider.ts
// Opt-in: when the rules are unsure, ask a decision model (chapter -> heading -> subheading) and put its
// answer first if it is confident. Any failure, timeout or low confidence keeps the rules' answer and flags
// needs_review. Never throws for decider problems; the default classify() is untouched.

import { classify, getLoadedTree } from "./classifier.js";
import { SECTION_MAP } from "./section-map.js";
import type { Candidate, ClassifyInput, HsNode } from "./types.js";
import type {
  ClassifyWithDeciderOptions,
  ClassifyWithDeciderResult,
  Decider,
  DeciderAnswer,
} from "./decider.js";

const REVIEW_BELOW = 0.8;

const key = (code: string) => `c${code}`;

class DeciderError extends Error {}

function criteria(nodes: HsNode[]): Record<string, string> {
  return Object.fromEntries(nodes.map((n) => [key(n.code), `${n.code}: ${n.description}`]));
}

/** jevDecider's errors carry only an HTTP status; anything else is reported generically. */
function safeMessage(e: unknown): string {
  const m = e instanceof Error ? e.message : "";
  return /^jev: (?:HTTP \d{3}|invalid JSON in response|response has no answer)$/.test(m) ? m : "decider failed";
}

function validConfidence(c: unknown): c is number {
  return typeof c === "number" && Number.isFinite(c) && c >= 0 && c <= 1;
}

/** Ask one step; returns the chosen node and its confidence. A single option needs no call. */
async function step(
  decider: Decider,
  state: string,
  instructions: string,
  nodes: HsNode[],
  signal: AbortSignal,
): Promise<{ node: HsNode; confidence: number }> {
  if (nodes.length === 1) return { node: nodes[0], confidence: 1 };
  const options = criteria(nodes);
  // Wrap so a decider that throws synchronously is handled like a rejection.
  const answer: DeciderAnswer = await Promise.resolve().then(() => decider(state, instructions, options, signal));
  if (signal.aborted) throw new DeciderError("timeout");
  const node = nodes.find((n) => key(n.code) === answer?.choice);
  if (!node) throw new DeciderError("answer not among the options");
  if (!validConfidence(answer.confidence)) throw new DeciderError("invalid confidence");
  return { node, confidence: answer.confidence };
}

export async function classifyWithDecider(
  input: ClassifyInput,
  options: ClassifyWithDeciderOptions,
): Promise<ClassifyWithDeciderResult> {
  const ruled = classify(input);
  if (!ruled.needs_review) return { ...ruled, decider: { used: false, asked: false } };
  const tree = getLoadedTree();
  if (!tree) return { ...ruled, decider: { used: false, asked: false, error: "tree not loaded" } };

  const minConfidence = options.minConfidence ?? 0.7;
  // setTimeout clamps anything above 2^31-1 ms (and Infinity) to 1ms; reject such values instead of timing out at once.
  const timeoutMs = options.timeoutMs ?? 5000;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 2_147_483_647) {
    throw new RangeError("timeoutMs must be a positive number of milliseconds up to 2147483647");
  }
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new DeciderError("timeout"));
    }, timeoutMs);
  });
  deadline.catch(() => {}); // the race below observes it; avoid an unhandled rejection when unused

  const ask = async () => {
    const s = controller.signal;
    const d = input.description;
    const ch = await step(options.decider, d, "Which Harmonized System (HS 2022) chapter classifies this traded product? Apply the General Interpretative Rules.", tree, s);
    const hd = await step(options.decider, d, `Which 4-digit HS heading within chapter ${ch.node.code} classifies this product?`, ch.node.children, s);
    const sb = await step(options.decider, d, `Which 6-digit HS subheading within heading ${hd.node.code} classifies this product?`, hd.node.children, s);
    return { ch, hd, sb };
  };

  let picked: Awaited<ReturnType<typeof ask>>;
  try {
    picked = await Promise.race([ask(), deadline]);
  } catch (e) {
    controller.abort();
    // Only messages known to be safe are reported; a decider's own error text could carry request details.
    const reason = e instanceof DeciderError ? e.message : safeMessage(e);
    return { ...ruled, needs_review: true, decider: { used: false, asked: true, error: reason } };
  } finally {
    clearTimeout(timer);
  }

  const confidence = { chapter: picked.ch.confidence, heading: picked.hd.confidence, subheading: picked.sb.confidence };
  if (confidence.heading < minConfidence) {
    return {
      ...ruled,
      needs_review: true,
      decider: { used: false, asked: true, confidence, error: `low confidence ${confidence.heading.toFixed(2)}` },
    };
  }

  const { ch, hd, sb } = picked;
  const section = SECTION_MAP.find((e) => e.chapters.includes(ch.node.code));
  const top: Candidate = {
    hscode: sb.node.code,
    description: sb.node.description,
    confidence: confidence.heading,
    matchedTokenCount: 0,
    reasoning: [
      `Section ${section?.section ?? "?"}: ${section?.title ?? ""}`,
      `Chapter ${ch.node.code}: ${ch.node.description}`,
      `Heading ${hd.node.code}: ${hd.node.description}`,
      `Subheading ${sb.node.code}: ${sb.node.description}`,
      `Decider: chapter ${confidence.chapter.toFixed(2)} / heading ${confidence.heading.toFixed(2)} / subheading ${confidence.subheading.toFixed(2)}`,
    ],
  };
  const rest = ruled.candidates
    .filter((c) => c.hscode !== top.hscode)
    .map((c) => ({ ...c, confidence: Math.min(c.confidence, top.confidence - 0.01) }));
  return {
    candidates: [top, ...rest].slice(0, 3),
    needs_review: confidence.chapter < REVIEW_BELOW || confidence.heading < REVIEW_BELOW || confidence.subheading < REVIEW_BELOW,
    decider: { used: true, asked: true, confidence },
  };
}
