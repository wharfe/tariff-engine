// compiler/jev-client.ts
// Build-time client for TypeSafe's Jev decision model (POST /v1/systemone).
// Key: TYPESAFE_API_KEY, else ~/.config/typesafe/api-key. Never logged.

import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

const ENDPOINT = "https://api.typesafe.ai/v1/systemone";

export interface ChoiceAnswer {
  choice: string;
  probabilities: Record<string, number>;
  confidence: number;
}

// Every successful call is logged so the budget survives restarts and counts
// steps whose later sibling failed (those never reach verified.jsonl).
export const USAGE_LOG = resolve("data/lookup-raw/usage.jsonl");

let tokensThisRun = 0;

/** Input tokens billed by this process (including steps whose sibling later failed). */
export function runTokens(): number {
  return tokensThisRun;
}

function logUsage(inputTokens: number): void {
  tokensThisRun += inputTokens;
  appendFileSync(USAGE_LOG, JSON.stringify({ t: inputTokens }) + "\n");
}

/** Total input tokens billed across all runs so far. */
export function spentTokens(): number {
  if (!existsSync(USAGE_LOG)) return 0;
  return readFileSync(USAGE_LOG, "utf-8")
    .split("\n")
    .reduce((s, l) => {
      try {
        return s + (JSON.parse(l) as { t: number }).t;
      } catch {
        return s;
      }
    }, 0);
}

let cachedKey: string | undefined;

function apiKey(): string {
  cachedKey ??= process.env.TYPESAFE_API_KEY ?? readFileSync(join(homedir(), ".config/typesafe/api-key"), "utf-8").trim();
  return cachedKey;
}

/** Ask one choice question. Returns the answer and the billed input tokens. */
export async function choose(
  state: string,
  instructions: string,
  criteria: Record<string, string>,
): Promise<{ answer: ChoiceAnswer; inputTokens: number }> {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey()}` },
      body: JSON.stringify({ model: "jev-latest", state, questions: { q: { type: "choice", instructions, criteria } } }),
    });
    if (res.ok) {
      const json = (await res.json()) as { answers: { q: ChoiceAnswer }; usage?: { input_tokens?: number } };
      const inputTokens = json.usage?.input_tokens ?? 0;
      logUsage(inputTokens);
      return { answer: json.answers.q, inputTokens };
    }
    const text = (await res.text()).slice(0, 200);
    if (attempt >= 3 || (res.status < 500 && res.status !== 429)) {
      throw new Error(`jev: HTTP ${res.status} ${text}`);
    }
    await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
  }
}
