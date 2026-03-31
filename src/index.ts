// src/index.ts

export { classify, loadTree, scoreSection, scoreNodes, scoreSubheading } from "./classifier.js";
export { tokenize } from "./tokenizer.js";
export { evaluateCondition } from "./rule-engine.js";
export { applyGir3a, applyGir3c } from "./gir.js";
export { SECTION_MAP } from "./section-map.js";
export type {
  ClassifyInput,
  ClassifyResult,
  Candidate,
  HsNode,
  RuleCondition,
  HeadingRule,
  ChapterRules,
} from "./types.js";
