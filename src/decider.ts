// src/decider.ts
// Types for the optional decision-model fallback (classifyWithDecider). The default classify() never uses these.

import type { ClassifyResult } from "./types.js";

/** One typed choice answered by a decision model (e.g. TypeSafe's Jev). */
export interface DeciderAnswer {
  /** key of the chosen option */
  choice: string;
  probabilities: Record<string, number>;
  /** 0..1 */
  confidence: number;
}

/**
 * Pick one of `options` (key -> description) for `state`. Must honour `signal`: when it aborts,
 * stop any network work and reject.
 */
export type Decider = (
  state: string,
  instructions: string,
  options: Record<string, string>,
  signal: AbortSignal,
) => Promise<DeciderAnswer>;

export interface DeciderReport {
  /** true when the decision model's answer is the top candidate */
  used: boolean;
  /** whether the decision model was asked at all */
  asked: boolean;
  confidence?: { chapter: number; heading: number; subheading: number };
  /** why the rules' answer was kept (never contains secrets) */
  error?: string;
}

export interface ClassifyWithDeciderResult extends ClassifyResult {
  decider: DeciderReport;
}

export interface ClassifyWithDeciderOptions {
  decider: Decider;
  /** heading confidence needed to put the decision model's answer first (default 0.7) */
  minConfidence?: number;
  /** one deadline for all calls, in ms (default 5000) */
  timeoutMs?: number;
}
