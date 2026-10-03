// tests/classify-with-decider.test.ts
// classifyWithDecider with fake decision models (no network).

import { describe, it, expect, beforeAll } from "vitest";
import { classify, loadTree } from "../src/classifier.js";
import { classifyWithDecider } from "../src/classify-with-decider.js";
import type { Decider, DeciderAnswer } from "../src/decider.js";

const UNSURE = "toothpaste, 100g"; // rules: needs_review, wrong chapter
const SURE = "live horses"; // rules: no review needed

/** Picks the option whose code starts with the wanted prefix at each step. */
function scripted(path: string[], confidence = 0.95): Decider & { calls: number } {
  const f = (async (_state: string, _instructions: string, options: Record<string, string>) => {
    f.calls++;
    const keyFor = Object.keys(options).find((k) => path.some((p) => k.slice(1) === p));
    return { choice: keyFor ?? Object.keys(options)[0], probabilities: {}, confidence } satisfies DeciderAnswer;
  }) as Decider & { calls: number };
  f.calls = 0;
  return f;
}

const TOOTHPASTE = ["33", "3306", "330610"];

beforeAll(() => {
  loadTree();
});

describe("confident decider", () => {
  it("puts the decider's subheading first with the tree path and confidences", async () => {
    const r = await classifyWithDecider({ description: UNSURE }, { decider: scripted(TOOTHPASTE) });
    const top = r.candidates[0];
    expect(top.hscode).toBe("330610");
    expect(r.decider).toMatchObject({ used: true, asked: true });
    expect(top.reasoning[0]).toMatch(/^Section VI/);
    expect(top.reasoning.at(-1)).toBe("Decider: chapter 0.95 / heading 0.95 / subheading 0.95");
    expect(r.needs_review).toBe(false);
  });

  it("keeps candidates sorted by confidence and without duplicates", async () => {
    const r = await classifyWithDecider({ description: UNSURE }, { decider: scripted(TOOTHPASTE) });
    const codes = r.candidates.map((c) => c.hscode);
    expect(new Set(codes).size).toBe(codes.length);
    for (let i = 1; i < r.candidates.length; i++) {
      expect(r.candidates[i].confidence).toBeLessThanOrEqual(r.candidates[i - 1].confidence);
    }
  });

  it("flags review when the subheading confidence alone is below 0.8", async () => {
    const d: Decider = async (_s, instructions, options) => {
      const keyFor = Object.keys(options).find((k) => TOOTHPASTE.includes(k.slice(1)))!;
      return { choice: keyFor, probabilities: {}, confidence: instructions.includes("6-digit") ? 0.6 : 0.95 };
    };
    const r = await classifyWithDecider({ description: UNSURE }, { decider: d });
    expect(r.decider.used).toBe(true);
    expect(r.needs_review).toBe(true);
  });

  it("rejects timeouts setTimeout cannot represent", async () => {
    await expect(classifyWithDecider({ description: UNSURE }, { decider: scripted(TOOTHPASTE), timeoutMs: Infinity })).rejects.toThrow(RangeError);
  });

  it("flags review when chapter or heading confidence is below 0.8", async () => {
    const r = await classifyWithDecider({ description: UNSURE }, { decider: scripted(TOOTHPASTE, 0.75) });
    expect(r.decider.used).toBe(true);
    expect(r.needs_review).toBe(true);
  });
});

describe("keeps the rules' answer", () => {
  const rulesOnly = () => classify({ description: UNSURE });

  it("when confidence is below minConfidence", async () => {
    const r = await classifyWithDecider({ description: UNSURE }, { decider: scripted(TOOTHPASTE, 0.5) });
    expect(r.candidates).toEqual(rulesOnly().candidates);
    expect(r.needs_review).toBe(true);
    expect(r.decider).toMatchObject({ used: false, asked: true, error: "low confidence 0.50" });
  });

  it.each([
    ["a synchronous throw", (() => { throw new Error("boom Bearer secret"); }) as unknown as Decider, "decider failed"],
    ["a rejection", (async () => { throw new Error("Bearer secret"); }) as Decider, "decider failed"],
    ["an unknown option", (async () => ({ choice: "c9999", probabilities: {}, confidence: 0.9 })) as Decider, "answer not among the options"],
    ["a string confidence", (async (_s, _i, o) => ({ choice: Object.keys(o)[0], probabilities: {}, confidence: "0.95" as unknown as number })) as Decider, "invalid confidence"],
    ["a NaN confidence", (async (_s, _i, o) => ({ choice: Object.keys(o)[0], probabilities: {}, confidence: NaN })) as Decider, "invalid confidence"],
    ["a confidence above 1", (async (_s, _i, o) => ({ choice: Object.keys(o)[0], probabilities: {}, confidence: 1.5 })) as Decider, "invalid confidence"],
    ["no answer", (async () => undefined as unknown as DeciderAnswer) as Decider, "answer not among the options"],
    ["a jev HTTP status", (async () => { throw new Error("jev: HTTP 402"); }) as Decider, "jev: HTTP 402"],
    ["a jev-like message with extra text", (async () => { throw new Error("jev: HTTP 401 Bearer secret"); }) as Decider, "decider failed"],
  ])("when the decider gives %s", async (_label, decider, error) => {
    const r = await classifyWithDecider({ description: UNSURE }, { decider });
    expect(r.candidates).toEqual(rulesOnly().candidates);
    expect(r.needs_review).toBe(true);
    expect(r.decider).toEqual({ used: false, asked: true, error });
    expect(JSON.stringify(r)).not.toContain("secret");
  });

  it("on timeout, and aborts the signal", async () => {
    let seen: AbortSignal | undefined;
    const slow: Decider = (_s, _i, _o, signal) => {
      seen = signal;
      return new Promise((_, reject) => signal.addEventListener("abort", () => reject(new Error("aborted"))));
    };
    const r = await classifyWithDecider({ description: UNSURE }, { decider: slow, timeoutMs: 50 });
    expect(r.decider).toEqual({ used: false, asked: true, error: "timeout" });
    expect(r.needs_review).toBe(true);
    expect(seen?.aborted).toBe(true);
  });
});

describe("deadline", () => {
  it("returns on time even when the decider ignores the signal and never settles", async () => {
    const stuck: Decider = () => new Promise(() => {});
    const start = performance.now();
    const r = await classifyWithDecider({ description: UNSURE }, { decider: stuck, timeoutMs: 50 });
    expect(performance.now() - start).toBeLessThan(500);
    expect(r.decider).toEqual({ used: false, asked: true, error: "timeout" });
  });
});

describe("does not ask", () => {
  it("when the rules need no review", async () => {
    const d = scripted(["01", "0101", "010129"]);
    const r = await classifyWithDecider({ description: SURE }, { decider: d });
    expect(d.calls).toBe(0);
    expect(r.decider).toEqual({ used: false, asked: false });
    expect(r.candidates).toEqual(classify({ description: SURE }).candidates);
  });

  it("for a step with a single option", async () => {
    // 3306 has several subheadings, but chapter -> heading -> subheading is 3 calls at most
    const d = scripted(TOOTHPASTE);
    await classifyWithDecider({ description: UNSURE }, { decider: d });
    expect(d.calls).toBeLessThanOrEqual(3);
    const tree = loadTree();
    const single = tree.flatMap((c) => c.children).find((h) => h.children.length === 1)!;
    const d2 = scripted([single.code.slice(0, 2), single.code, single.children[0].code]);
    await classifyWithDecider({ description: UNSURE }, { decider: d2 });
    expect(d2.calls).toBe(2);
  });
});
