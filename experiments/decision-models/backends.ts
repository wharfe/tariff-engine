// experiments/decision-models/backends.ts
// One request shape (state + typed questions) for every decision model; only the endpoint differs.

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface ChoiceQuestion {
  type: "choice";
  instructions: string;
  criteria: Record<string, string>;
}

export interface ChoiceAnswer {
  type: "choice";
  choice: string;
  probabilities: Record<string, number>;
  confidence: number;
}

export interface DecisionResponse {
  answers: Record<string, ChoiceAnswer>;
  inputTokens: number;
  ms: number;
}

export type ModelName = "jev" | "clef" | "clef-flash" | "decider";

export const MODELS: ModelName[] = ["jev", "clef", "clef-flash", "decider"];

// USD per 1M input tokens (output is free on all hosted ones).
export const PRICE_PER_MTOK: Record<ModelName, number> = {
  jev: 0.042,
  clef: 0.24,
  "clef-flash": 0.09,
  decider: 0,
};

const RELAY_URL = process.env.CLEF_RELAY_URL ?? "http://127.0.0.1:8787";
const DECIDER_URL = process.env.DECIDER_URL ?? "http://127.0.0.1:8000";

function jevKey(): string {
  // Read at call time and never print it.
  return readFileSync(join(homedir(), ".config/typesafe/api-key"), "utf-8").trim();
}

function endpoint(model: ModelName): { url: string; headers: Record<string, string>; body: Record<string, unknown> } {
  switch (model) {
    case "jev":
      return {
        url: "https://api.typesafe.ai/v1/systemone",
        headers: { Authorization: `Bearer ${jevKey()}` },
        body: { model: "jev-latest" },
      };
    case "clef":
    case "clef-flash":
      return { url: `${RELAY_URL}/v1/systemone?model=${model}`, headers: {}, body: {} };
    case "decider":
      return { url: `${DECIDER_URL}/v1/systemone`, headers: {}, body: {} };
  }
}

export async function ask(
  model: ModelName,
  state: string,
  questions: Record<string, ChoiceQuestion>,
): Promise<DecisionResponse> {
  const { url, headers, body } = endpoint(model);
  const started = performance.now();
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({ ...body, state, questions }),
    });
    if (res.ok) {
      const json = (await res.json()) as { answers: Record<string, ChoiceAnswer>; usage?: { input_tokens?: number } };
      return { answers: json.answers, inputTokens: json.usage?.input_tokens ?? 0, ms: performance.now() - started };
    }
    // Error bodies may echo request headers on some gateways; keep only status and a short prefix.
    const text = (await res.text()).slice(0, 200);
    if (attempt >= 3 || (res.status < 500 && res.status !== 429)) {
      throw new Error(`${model}: HTTP ${res.status} ${text}`);
    }
    await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
  }
}
