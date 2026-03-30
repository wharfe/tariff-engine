// src/index.ts

export { classify } from "./classifier.js";
export { tokenize } from "./tokenizer.js";
export { evaluateCondition } from "./rule-engine.js";
export { applyGir3a, applyGir3c } from "./gir.js";
export type {
  ClassifyInput,
  ClassifyResult,
  Candidate,
  HsNode,
  RuleCondition,
  HeadingRule,
  ChapterRules,
} from "./types.js";
