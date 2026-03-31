// src/index.ts

export { classify, loadTree, scoreSection, scoreNodes, scoreSubheading } from "./classifier.js";
export { tokenize } from "./tokenizer.js";
export { evaluateCondition } from "./rule-engine.js";
export { applyGir3a, applyGir3c } from "./gir.js";
export { SECTION_MAP } from "./section-map.js";
export { simpleStem, cachedStem, stemSet, stemMatchCount } from "./stemmer.js";
export { STRONG_SYNONYMS, WEAK_SYNONYMS, FUNCTION_WORDS, expandTokensStrong, expandTokensAll } from "./lexicon.js";
export { FUNCTION_SECTION_ROUTES, PRODUCT_CHAPTER_ROUTES } from "./routes.js";
export { SCORING, scoreDescription, bestDescScore } from "./scoring.js";
export type {
  ClassifyInput,
  ClassifyResult,
  Candidate,
  HsNode,
  RuleCondition,
  HeadingRule,
  ChapterRules,
} from "./types.js";
