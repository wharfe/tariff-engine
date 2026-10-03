// tests/jev.test.ts
// jevDecider with an injected fetch (no network).

import { describe, it, expect } from "vitest";
import { jevDecider } from "../src/jev.js";

const KEY = "sk-test-0123456789";

function fakeFetch(responses: Array<{ status: number; body: unknown }>) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const f = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const r = responses[Math.min(calls.length - 1, responses.length - 1)];
    return new Response(typeof r.body === "string" ? r.body : JSON.stringify(r.body), { status: r.status });
  }) as unknown as typeof fetch;
  return { f, calls };
}

const OK = { answers: { q: { type: "choice", choice: "c33", probabilities: { c33: 0.9 }, confidence: 0.9 } }, usage: { input_tokens: 10 } };

describe("jevDecider", () => {
  it("sends one choice question with the key as a bearer token", async () => {
    const { f, calls } = fakeFetch([{ status: 200, body: OK }]);
    const ask = jevDecider({ apiKey: KEY, fetch: f });
    const a = await ask("toothpaste", "Which chapter?", { c33: "33: Essential oils", c34: "34: Soap" }, new AbortController().signal);
    expect(a.choice).toBe("c33");
    expect(calls[0].url).toBe("https://api.typesafe.ai/v1/systemone");
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe(`Bearer ${KEY}`);
    expect(JSON.parse(calls[0].init.body as string)).toEqual({
      model: "jev-latest",
      state: "toothpaste",
      questions: { q: { type: "choice", instructions: "Which chapter?", criteria: { c33: "33: Essential oils", c34: "34: Soap" } } },
    });
  });

  it("retries once on 429", async () => {
    const { f, calls } = fakeFetch([{ status: 429, body: "slow down" }, { status: 200, body: OK }]);
    const a = await jevDecider({ apiKey: KEY, fetch: f })("x", "q", { c33: "a", c34: "b" }, new AbortController().signal);
    expect(a.confidence).toBe(0.9);
    expect(calls).toHaveLength(2);
  });

  it("never puts the key in an error, even when the response body echoes it", async () => {
    const { f } = fakeFetch([{ status: 401, body: `invalid key: Authorization: Bearer ${KEY}` }]);
    const err = await jevDecider({ apiKey: KEY, fetch: f })("x", "q", { c33: "a", c34: "b" }, new AbortController().signal).catch((e) => e);
    expect(String(err)).toBe("Error: jev: HTTP 401");
    expect(String(err)).not.toContain(KEY);
  });

  it("does not quote a malformed body", async () => {
    const { f } = fakeFetch([{ status: 200, body: `Bearer ${KEY} not json` }]);
    const err = await jevDecider({ apiKey: KEY, fetch: f })("x", "q", { c33: "a", c34: "b" }, new AbortController().signal).catch((e) => e);
    expect(String(err)).toBe("Error: jev: invalid JSON in response");
  });

  it("stops waiting between retries when the signal aborts", async () => {
    const { f, calls } = fakeFetch([{ status: 503, body: "" }, { status: 200, body: OK }]);
    const c = new AbortController();
    const p = jevDecider({ apiKey: KEY, fetch: f })("x", "q", { c33: "a", c34: "b" }, c.signal);
    setTimeout(() => c.abort(), 10);
    await expect(p).rejects.toThrow();
    expect(calls).toHaveLength(1);
  });

  it("passes the signal to fetch", async () => {
    const { f, calls } = fakeFetch([{ status: 200, body: OK }]);
    const c = new AbortController();
    await jevDecider({ apiKey: KEY, fetch: f })("x", "q", { c33: "a", c34: "b" }, c.signal);
    expect(calls[0].init.signal).toBe(c.signal);
  });
});
