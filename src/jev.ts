// src/jev.ts
// Decider for TypeSafe's Jev (POST /v1/systemone), published as "tariff-engine/jev".
// The key is passed in by the caller; nothing is read from the environment. Error messages carry only the
// HTTP status: response bodies are never echoed, since gateways may reflect request headers.

import type { Decider, DeciderAnswer } from "./decider.js";

export interface JevDeciderOptions {
  apiKey: string;
  model?: string;
  endpoint?: string;
  /** fetch implementation (defaults to the global one; injectable for tests) */
  fetch?: typeof fetch;
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new Error("aborted"));
    const t = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        reject(new Error("aborted"));
      },
      { once: true },
    );
  });
}

export function jevDecider(opts: JevDeciderOptions): Decider {
  const endpoint = opts.endpoint ?? "https://api.typesafe.ai/v1/systemone";
  const model = opts.model ?? "jev-latest";
  const doFetch = opts.fetch ?? fetch;

  return async (state, instructions, options, signal) => {
    const body = JSON.stringify({ model, state, questions: { q: { type: "choice", instructions, criteria: options } } });
    for (let attempt = 1; ; attempt++) {
      const res = await doFetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${opts.apiKey}` },
        body,
        signal,
      });
      if (res.ok) {
        let json: { answers?: { q?: DeciderAnswer } };
        try {
          json = (await res.json()) as typeof json;
        } catch {
          throw new Error("jev: invalid JSON in response"); // SyntaxError text would quote the body
        }
        const q = json.answers?.q;
        if (!q) throw new Error("jev: response has no answer");
        return q;
      }
      // Drain without reading into the error: the body may echo the Authorization header.
      await res.body?.cancel().catch(() => {});
      if (attempt >= 2 || (res.status < 500 && res.status !== 429)) throw new Error(`jev: HTTP ${res.status}`);
      await sleep(1000, signal);
    }
  };
}
