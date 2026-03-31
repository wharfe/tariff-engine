// src/classifier.ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { HsNode, ClassifyInput, ClassifyResult, Candidate } from "./types.js";
import { SECTION_MAP } from "./section-map.js";
import { tokenize } from "./tokenizer.js";
import { applyGir3a, applyGir3c } from "./gir.js";

let cachedTree: HsNode[] | null = null;

const DEFAULT_PATH = resolve(process.cwd(), "data/hs-tree.json");

export function loadTree(
  path?: string,
  options?: { force?: boolean },
): HsNode[] {
  if (cachedTree && !options?.force) return cachedTree;
  const filePath = path ?? DEFAULT_PATH;
  const raw = readFileSync(filePath, "utf-8");
  cachedTree = JSON.parse(raw) as HsNode[];
  return cachedTree;
}

export interface ScoredSection {
  section: string;
  title: string;
  score: number;
  chapters: string[];
}

// Simple English stemmer: reduce common plurals/suffixes to a base form.
// This handles the most frequent mismatches (bicycle vs bicycles, knife vs knives).
// Known limitations: irregular forms (leaves→leafe not leaf), -ing over-stems (running→runn).
// These are acceptable for Phase 1 since stem matching is additive (original tokens still match).
const STEM_EXCEPTIONS = new Set([
  "series", "species", "indices", "matrices", "vertices", "cookies",
  "leaves", "lives",
]);

function simpleStem(word: string): string {
  if (word.length <= 3) return word;
  if (STEM_EXCEPTIONS.has(word)) return word;
  // -ies → -y (batteries→battery)
  if (word.endsWith("ies") && word.length > 4) return word.slice(0, -3) + "y";
  // -ves → -f/-fe (knives→knife)
  if (word.endsWith("ves")) return word.slice(0, -3) + "fe";
  // -ses → -s (cases) or -se (buses→bus) — keep as-is for safety, just strip trailing "es"
  if (word.endsWith("sses")) return word.slice(0, -2);
  if (word.endsWith("shes") || word.endsWith("ches") || word.endsWith("xes") || word.endsWith("zes")) return word.slice(0, -2);
  // -ied → -y (dried→dry)
  if (word.endsWith("ied") && word.length > 4) return word.slice(0, -3) + "y";
  // -ed → base (rolled→roll, plated→plate) but not "bed", "red"
  if (word.endsWith("ed") && word.length > 4) {
    if (word.endsWith("ked") || word.endsWith("ged") || word.endsWith("med") ||
        word.endsWith("ned") || word.endsWith("ped") || word.endsWith("ted") ||
        word.endsWith("xed") || word.endsWith("ved") || word.endsWith("wed") ||
        word.endsWith("zed") || word.endsWith("fed") || word.endsWith("led") ||
        word.endsWith("red") || word.endsWith("sed")) {
      return word.slice(0, -2);
    }
    // -ated → -ate, -ised → -ise, etc.
    if (word.endsWith("ated") || word.endsWith("ised") || word.endsWith("ized")) {
      return word.slice(0, -1);
    }
  }
  // -ing → base (rolling→roll) but not "ring", "king"
  if (word.endsWith("ing") && word.length > 5) {
    return word.slice(0, -3);
  }
  // -s (plural) but not -ss, -us, -is
  if (word.endsWith("s") && !word.endsWith("ss") && !word.endsWith("us") && !word.endsWith("is")) {
    return word.slice(0, -1);
  }
  return word;
}

// Build a stem-based set for efficient matching
function stemSet(tokens: string[]): Set<string> {
  const s = new Set<string>();
  for (const t of tokens) {
    s.add(t);
    s.add(cachedStem(t));
  }
  return s;
}

// Simple stem cache to avoid recomputation
const stemCache = new Map<string, string>();
function cachedStem(word: string): string {
  let s = stemCache.get(word);
  if (s === undefined) {
    s = simpleStem(word);
    stemCache.set(word, s);
  }
  return s;
}

// Check if any token from `tokens` matches any token in `descTokens` considering stems
function stemMatchCount(inputTokens: string[], descTokens: Set<string>): number {
  const descStems = new Set<string>();
  for (const t of descTokens) {
    descStems.add(t);
    descStems.add(cachedStem(t));
  }
  let count = 0;
  for (const t of inputTokens) {
    if (descStems.has(t) || descStems.has(cachedStem(t))) count++;
  }
  return count;
}

// Synonym/expansion map: common product terms → HS description terms
// "strong" synonyms are near-equivalents (chair≈seat), "weak" are broader (salmon→fish)
// Strong synonyms: the synonym IS the HS term for this product
const STRONG_SYNONYMS: Record<string, string[]> = {
  chair: ["seat", "seats"],
  sofa: ["seat", "seats"],
  couch: ["seat", "seats"],
  bench: ["seat", "seats"],
  stool: ["seat", "seats"],
  pipe: ["tubes", "pipes"],
  tube: ["tubes", "pipes"],
  beef: ["bovine"],
  pork: ["swine"],
  shoe: ["footwear"],
  shoes: ["footwear"],
  boot: ["footwear"],
  boots: ["footwear"],
  sneaker: ["footwear"],
  sandal: ["footwear"],
  slipper: ["footwear"],
  necklace: ["jewellery", "jewelry", "articles"],
  ring: ["jewellery", "jewelry"],
  bracelet: ["jewellery", "jewelry"],
  knife: ["knives"],
  knives: ["knife"],
  oven: ["heating", "electro-thermic"],
  microwave: ["electro-thermic"],
  bottle: ["bottles"],
  bottles: ["bottle"],
  mug: ["tableware", "kitchenware"],
  cup: ["tableware", "kitchenware"],
  toothbrush: ["electro-mechanical"],
  scooter: ["motorcycles", "cycles"],
  backpack: ["bags", "luggage", "travel"],
  wallet: ["cases", "articles"],
  suitcase: ["luggage", "cases"],
  thermometer: ["instruments", "measuring"],
  tracker: ["watches", "watch"],
  painting: ["paintings"],
  paintings: ["painting"],
  vase: ["articles"],
  cutlery: ["spoons", "forks", "ladles", "kitchen"],
  foil: ["foil"],
  kitchen: ["knives", "cutting"],
  stainless: ["stainless"],
};

const WEAK_SYNONYMS: Record<string, string[]> = {
  beef: ["meat"],
  pork: ["meat"],
  chicken: ["poultry", "fowl", "meat"],
  salmon: ["fish"],
  tuna: ["fish"],
  shrimp: ["crustacean"],
  table: ["furniture"],
  desk: ["furniture"],
  cabinet: ["furniture"],
  shelf: ["furniture"],
  // Note: chair/sofa have strong synonyms (seat/seats), no weak synonym to "furniture"
  // to avoid matching n.e.c. furniture headings over specific seat headings
  drink: ["waters", "beverages", "water"],
  energy: ["waters", "beverages"],
  sanitizer: ["disinfectants", "insecticides"],
  aspirin: ["medicaments", "pharmaceutical", "dosage"],
  tablet: ["medicaments", "dosage"],
  tablets: ["medicaments", "dosage"],
  plywood: ["plywood"],
  coffee: ["coffee"],
  bean: ["coffee"],
  beans: ["coffee"],
  shark: ["fish", "dried", "salted"],
  fin: ["fish", "dried"],
  fins: ["fish", "dried"],
  necklace: ["articles", "jewellery"],
  gold: ["precious"],
  foil: ["aluminium", "aluminum"],
  aluminum: ["aluminium"],
  porcelain: ["porcelain", "china"],
  antique: ["antiques", "collections"],
  vase: ["household", "articles"],
  thermometer: ["temperature", "measuring"],
  digital: ["electronic"],
  lamp: ["lamps", "lighting"],
};

// Compound terms that should NOT match partial overlaps.
// e.g. "pipe" should not strongly match "pipe fittings" — fittings are a different product.
// Format: token → list of adjacent words that weaken the match.
const WEAKENING_ADJACENTS: Record<string, string[]> = {
  pipe: ["fittings", "fitting"],
  tube: ["fittings", "fitting"],
  yarn: ["waste"],
};

// Expand input tokens with strong synonyms (near-equivalents)
function expandTokensStrong(tokens: string[]): string[] {
  const expanded = [...tokens];
  for (const t of tokens) {
    const syns = STRONG_SYNONYMS[t];
    if (syns) {
      for (const s of syns) {
        if (!expanded.includes(s)) expanded.push(s);
      }
    }
  }
  return expanded;
}

// Expand input tokens with all synonyms (strong + weak)
function expandTokensAll(tokens: string[]): string[] {
  const expanded = expandTokensStrong(tokens);
  for (const t of tokens) {
    const syns = WEAK_SYNONYMS[t];
    if (syns) {
      for (const s of syns) {
        if (!expanded.includes(s)) expanded.push(s);
      }
    }
  }
  return expanded;
}

// Function-word boost: these words indicate the product's function/use,
// which in HS takes priority over material (GIR 3(b) spirit).
const FUNCTION_WORDS = new Set([
  // Furniture (Ch.94)
  "chair", "table", "desk", "bed", "seat", "sofa", "couch",
  "lamp", "lighting", "furniture", "cabinet", "shelf", "mattress",
  // Toys/sports (Ch.95)
  "toy", "game", "brush", "broom",
  // Footwear (Section XII)
  "shoe", "shoes", "boot", "boots", "sandal", "slipper", "sneaker", "footwear",
  // Clothing/garments (Section XI Ch.61-62)
  "shirt", "t-shirt", "dress", "trouser", "jacket", "coat", "garment", "clothing",
  // Bags/luggage (Section VIII Ch.42)
  "backpack", "suitcase", "briefcase", "wallet", "purse", "handbag",
  // Jewelry (Section XIV Ch.71)
  "necklace", "ring", "bracelet", "earring", "jewelry", "jewellery",
  // Cutlery/tools (Section XV Ch.82)
  "knife", "fork", "spoon", "cutlery",
  // Kitchen/tableware (Section XIII Ch.69)
  "mug", "cup", "plate", "bowl",
  // Instruments (Section XVIII Ch.90-91)
  "thermometer", "tracker", "watch",
]);

// Material words that should be deprioritized when function words are present
const MATERIAL_SECTIONS = new Set(["VII", "IX", "XIII", "XV"]); // plastics, wood, stone/ceramic, metals

// Function words that route to specific sections, overriding material-based classification
// Maps function words to their correct section (used to boost the right section)
const FUNCTION_SECTION_ROUTES: Record<string, string> = {
  // Furniture → Section XX
  chair: "XX", table: "XX", desk: "XX", bed: "XX", sofa: "XX",
  couch: "XX", lamp: "XX", mattress: "XX", furniture: "XX",
  // Footwear → Section XII
  shoe: "XII", shoes: "XII", boot: "XII", boots: "XII",
  sandal: "XII", slipper: "XII", sneaker: "XII", footwear: "XII",
  // Clothing → Section XI (but chapters 61-62 for garments, not raw textile chapters)
  shirt: "XI", "t-shirt": "XI", dress: "XI", trouser: "XI",
  jacket: "XI", coat: "XI", garment: "XI", clothing: "XI",
  // Bags → Section VIII
  backpack: "VIII", suitcase: "VIII", briefcase: "VIII",
  wallet: "VIII", purse: "VIII",
  // Jewelry → Section XIV
  necklace: "XIV", bracelet: "XIV", earring: "XIV",
  // Cutlery/knives → Section XV (Ch.82)
  knife: "XV", cutlery: "XV",
  // Tableware → Section XIII
  mug: "XIII", cup: "XIII",
};

// Material tokens: when scoring headings in function-classified chapters,
// these tokens get lower weight for heading selection
const MATERIAL_TOKENS = new Set([
  "plastic", "plastics", "wood", "wooden", "metal", "iron", "steel",
  "copper", "aluminium", "aluminum", "glass", "ceramic", "rubber",
  "bamboo", "rattan", "leather", "stone",
]);

// Chapters where function/product-type determines the heading, not material
const FUNCTION_CHAPTERS = new Set(["94", "95", "96"]);

// Direct chapter routing: when specific product-type words are present,
// force consideration of specific chapters (bypasses pure keyword scoring).
// This handles cases like "knife" → Ch.82, "necklace" → Ch.71
const PRODUCT_CHAPTER_ROUTES: Record<string, string[]> = {
  knife: ["82"],
  knives: ["82"],
  cutlery: ["82"],
  fork: ["82"],
  spoon: ["82"],
  necklace: ["71"],
  bracelet: ["71"],
  earring: ["71"],
  ring: ["71"],
  jewelry: ["71"],
  jewellery: ["71"],
  thermometer: ["90"],
  tracker: ["91"],
  watch: ["91"],
  lamp: ["94"],
  lighting: ["94"],
  scooter: ["87"],
  bicycle: ["87"],
  cycle: ["87"],
  toothbrush: ["85"],
  oven: ["85"],
  microwave: ["85"],
  drink: ["22"],
  beverage: ["22"],
  sanitizer: ["38"],
  disinfectant: ["38"],
  aspirin: ["30"],
  medicine: ["30"],
  tablet: ["30"],
  tablets: ["30"],
  coffee: ["09"],
  plywood: ["44"],
  backpack: ["42"],
  wallet: ["42"],
  suitcase: ["42"],
  boot: ["64"],
  boots: ["64"],
  shoe: ["64"],
  shoes: ["64"],
  shirt: ["61"],
  "t-shirt": ["61"],
  mug: ["69"],
  foil: ["76"],
  antique: ["97"],
  painting: ["97"],
};

export function scoreSection(inputTokens: string[]): ScoredSection[] {
  if (inputTokens.length === 0) return [];

  const hasFunctionWord = inputTokens.some((t) => FUNCTION_WORDS.has(t));

  // Determine function-based section routing
  let functionRouteSection: string | null = null;
  for (const t of inputTokens) {
    if (FUNCTION_SECTION_ROUTES[t]) {
      functionRouteSection = FUNCTION_SECTION_ROUTES[t];
      break;
    }
  }

  const scored: ScoredSection[] = SECTION_MAP.map((entry) => {
    const keywordSet = new Set(entry.keywords);
    // Also build stemmed keyword set for fuzzy matching
    const keywordStemSet = stemSet(entry.keywords);
    let matched = 0;
    for (const t of inputTokens) {
      if (keywordSet.has(t) || keywordStemSet.has(t) || keywordStemSet.has(cachedStem(t))) {
        matched++;
      }
    }
    let score = matched / inputTokens.length;

    // When a function word is present, penalize material sections
    if (hasFunctionWord && MATERIAL_SECTIONS.has(entry.section)) {
      score *= 0.3;
    }

    // Boost the function-routed section
    if (functionRouteSection && entry.section === functionRouteSection) {
      score = Math.max(score, 0.8);
    }

    // Penalize material-based sections when function routing is active
    // e.g. "leather shoes" should not go to Section VIII (leather), but XII (footwear)
    if (functionRouteSection && entry.section !== functionRouteSection) {
      // Only penalize sections that are "material" for this product
      const materialPenaltySections = new Set(["VII", "VIII", "IX", "XI", "XIII", "XIV", "XV"]);
      if (materialPenaltySections.has(entry.section)) {
        score *= 0.4;
      }
    }

    return {
      section: entry.section,
      title: entry.title,
      score,
      chapters: entry.chapters,
    };
  });

  // Filter: >= 50% of max score, minimum 3
  const maxScore = Math.max(...scored.map((s) => s.score));
  const threshold = maxScore * 0.5;
  const filtered = scored
    .filter((s) => s.score >= threshold && s.score > 0)
    .sort((a, b) => b.score - a.score);

  if (filtered.length >= 3) return filtered;
  return scored.sort((a, b) => b.score - a.score).slice(0, 3);
}

export interface ScoredNode {
  node: HsNode;
  score: number;
}

// Regex to detect incidental/cross-reference mentions of terms
// e.g. "except rice of heading 1006" or "other than rice" or "of heading no. 1006"
const CROSS_REF_RE = /\b(?:except|excluding|other than|of heading(?:\s+no\.?)?)\s/i;

/**
 * Score how well a description matches input tokens, penalizing incidental mentions.
 * A "direct" description like "Rice" scores higher than one that says
 * "except rice of heading 1006".
 */
// Cache tokenized descriptions to avoid re-tokenizing
const descTokenCache = new Map<string, string[]>();
function cachedTokenize(description: string): string[] {
  let tokens = descTokenCache.get(description);
  if (!tokens) {
    tokens = tokenize(description);
    descTokenCache.set(description, tokens);
  }
  return tokens;
}

function scoreDescription(inputTokens: string[], description: string): number {
  const descTokenList = cachedTokenize(description);
  const descTokens = new Set(descTokenList);
  const matched = stemMatchCount(inputTokens, descTokens);
  let score = inputTokens.length > 0 ? matched / inputTokens.length : 0;

  if (score > 0 && CROSS_REF_RE.test(description)) {
    // Check if the matched tokens appear mainly in cross-reference context
    const descLower = description.toLowerCase();
    const crossRefParts = descLower.split(/[;,]/).filter((part) =>
      CROSS_REF_RE.test(part),
    );
    const directParts = descLower.split(/[;,]/).filter(
      (part) => !CROSS_REF_RE.test(part),
    );

    const crossRefTokens = new Set(crossRefParts.flatMap((p) => tokenize(p)));
    const directTokens = new Set(directParts.flatMap((p) => tokenize(p)));

    // Count how many input tokens match only in cross-ref context vs direct
    let crossRefOnly = 0;
    let directMatch = 0;
    for (const t of inputTokens) {
      if (directTokens.has(t)) directMatch++;
      else if (crossRefTokens.has(t)) crossRefOnly++;
    }

    // If most matches are from cross-references, heavily penalize
    if (crossRefOnly > 0 && directMatch === 0) {
      score *= 0.1;
    } else if (crossRefOnly > directMatch) {
      score *= 0.4;
    }
  }

  // Penalize when input token matches a word that is modified by a weakening adjacent.
  // e.g. "yarn" in "yarn waste" should score lower than "yarn" in "cotton yarn"
  if (score > 0) {
    const descWords = description.toLowerCase().split(/[\s;,()]+/);
    for (const t of inputTokens) {
      const weakeners = WEAKENING_ADJACENTS[t];
      if (!weakeners || !descTokens.has(t)) continue;
      const idx = descWords.indexOf(t);
      if (idx >= 0) {
        const nextWord = descWords[idx + 1] ?? "";
        const prevWord = descWords[idx - 1] ?? "";
        if (weakeners.includes(nextWord) || weakeners.includes(prevWord)) {
          score *= 0.5;
        }
      }
    }
  }

  // Bonus for high coverage of the description (input covers most of what the heading is about).
  // Penalty when the description has many important terms not in the input
  // (the heading is about something more specific/different).
  const descTokenCount = descTokenList.length;
  if (descTokenCount > 0 && matched > 0) {
    const inputStemSet = stemSet(inputTokens);
    // What fraction of the description's key terms does the input cover?
    const descCoverage = descTokenList.filter((t) => inputStemSet.has(t) || inputStemSet.has(cachedStem(t))).length / descTokenCount;
    // Blend: base score + coverage/specificity bonus
    score = score * 0.7 + Math.min(descCoverage, 1.0) * 0.15 + Math.min(matched / descTokenCount, 1.0) * 0.15;
  }

  return score;
}

// Score a node description using original + synonym-expanded tokens
function bestDescScore(inputTokens: string[], strongExpanded: string[], allExpanded: string[], description: string): number {
  let score = scoreDescription(inputTokens, description);
  // Strong synonyms (near-equivalents like chair→seat) at high weight
  const strongScore = scoreDescription(strongExpanded, description);
  if (strongScore > score) {
    score = Math.max(score, strongScore * 0.95);
  }
  // All synonyms (including weak like salmon→fish) at lower weight
  const allScore = scoreDescription(allExpanded, description);
  if (allScore > score) {
    score = Math.max(score, allScore * 0.75);
  }
  return score;
}

export function scoreNodes(inputTokens: string[], nodes: HsNode[]): ScoredNode[] {
  if (inputTokens.length === 0 || nodes.length === 0) return [];

  // Expand tokens with synonyms for better matching
  const strongExpanded = expandTokensStrong(inputTokens);
  const allExpanded = expandTokensAll(inputTokens);

  const scored: ScoredNode[] = nodes.map((node) => {
    let score = bestDescScore(inputTokens, strongExpanded, allExpanded, node.description);

    // Deep match: check children descriptions for additional matches
    // This handles cases like Chapter 10 "Cereals" not containing "rice",
    // but Heading 1006 "Rice" does.
    if (node.children.length > 0) {
      let bestChildScore = 0;
      for (const child of node.children) {
        const childScore = bestDescScore(inputTokens, strongExpanded, allExpanded, child.description);
        if (childScore > bestChildScore) bestChildScore = childScore;

        // Also check grandchildren (2-level deep match)
        for (const grandchild of child.children) {
          const gcScore = bestDescScore(inputTokens, strongExpanded, allExpanded, grandchild.description);
          // Grandchild match is less reliable
          const gcAdjusted = gcScore * 0.7;
          if (gcAdjusted > bestChildScore) bestChildScore = gcAdjusted;
        }
      }
      // Use child score to supplement parent score
      // If parent has no direct match, use child score at 0.7 weight
      // If parent has some match, blend with child score
      if (score === 0) {
        score = bestChildScore * 0.7;
      } else if (bestChildScore > score) {
        score = score * 0.6 + bestChildScore * 0.4;
      }
    }

    return { node, score };
  });

  const maxScore = Math.max(...scored.map((s) => s.score));
  if (maxScore === 0) {
    return scored.sort((a, b) => b.score - a.score).slice(0, 3);
  }
  const threshold = maxScore * 0.5;
  const filtered = scored
    .filter((s) => s.score >= threshold && s.score > 0)
    .sort((a, b) => b.score - a.score);

  if (filtered.length >= 3) return filtered;
  return scored.sort((a, b) => b.score - a.score).slice(0, 3);
}

const OTHER_THAN_RE = /other than ([^;,]+)/i;
const FALLBACK_RE = /\bn\.e\.s\.i\b|\bn\.e\.c\b|\bnot elsewhere\b/i;
const FALLBACK_PENALTY = 0.3;

export function scoreSubheading(inputTokens: string[], node: HsNode): number {
  const strongExpanded = expandTokensStrong(inputTokens);
  const allExpanded = expandTokensAll(inputTokens);
  let score = bestDescScore(inputTokens, strongExpanded, allExpanded, node.description);

  // "other than X" pattern
  const otherThanMatch = node.description.match(OTHER_THAN_RE);
  if (otherThanMatch) {
    const excludedTokens = tokenize(otherThanMatch[1]);
    const inputStemmed = stemSet(inputTokens);
    const hasExcluded = excludedTokens.some((t) => inputStemmed.has(t) || inputStemmed.has(cachedStem(t)));
    if (hasExcluded) return 0;
    // Input does NOT contain excluded terms → this IS the correct catch-all.
    // Give a small boost over specific siblings that also match generically.
    score *= 1.05;
  }

  // Negation penalty: when description says "not X" and input contains X,
  // penalize this subheading (e.g. "not rolled" should not match "roll").
  // Skip "whether or not", "or not", "not exceeding", etc.
  const descLower = node.description.toLowerCase();
  const notMatches = descLower.matchAll(/(?<!\bwhether\s)(?<!\bor\s)\bnot\s+(\w+)/g);
  for (const m of notMatches) {
    const negatedWord = m[1];
    if (negatedWord === "elsewhere" || negatedWord === "exceeding" ||
        negatedWord === "backed" || negatedWord === "chemically" ||
        negatedWord === "further" || negatedWord === "exceeding") continue;
    const negatedStem = cachedStem(negatedWord);
    for (const t of inputTokens) {
      if (t === negatedWord || cachedStem(t) === negatedStem || t === negatedStem) {
        score *= 0.3;
        break;
      }
    }
  }

  // Fallback penalty: n.e.s.i., n.e.c., or description starts with "Other"
  // But NOT for "other than X" patterns (already handled above)
  const isFallback =
    (FALLBACK_RE.test(node.description) ||
    node.description.startsWith("Other ")) &&
    !otherThanMatch;
  if (isFallback) {
    score *= FALLBACK_PENALTY;
  }

  return score;
}

const NEEDS_REVIEW_THRESHOLD = 0.7;
const WEIGHTS = { section: 0.1, chapter: 0.2, heading: 0.4, subheading: 0.3 };

export function classify(input: ClassifyInput): ClassifyResult {
  const tree = cachedTree;
  if (!tree) {
    throw new Error("Tree not loaded. Call loadTree() first.");
  }

  const tokens = tokenize(input.description);
  if (tokens.length === 0) {
    return { candidates: [], needs_review: true };
  }

  // Step 1: Score sections
  const sections = scoreSection(tokens);
  if (sections.length === 0) {
    return { candidates: [], needs_review: true };
  }

  // Step 2: Get candidate chapters from matched sections
  const sectionChapterCodes = new Set(sections.flatMap((s) => s.chapters));

  // Add product-routed chapters to candidate set
  const routedChapterCodes = new Set<string>();
  for (const t of tokens) {
    const routes = PRODUCT_CHAPTER_ROUTES[t];
    if (routes) {
      for (const ch of routes) {
        sectionChapterCodes.add(ch);
        routedChapterCodes.add(ch);
      }
    }
  }

  const candidateChapters = tree.filter((ch) => sectionChapterCodes.has(ch.code));
  let chapterScores = scoreNodes(tokens, candidateChapters);

  // Boost routed chapters and demote non-routed when function routing is active
  if (routedChapterCodes.size > 0) {
    // Determine which sections are being penalized by function routing
    const penalizedSections = new Set<string>();
    const functionRouteSection = tokens.reduce<string | null>((acc, t) => FUNCTION_SECTION_ROUTES[t] ?? acc, null);
    if (functionRouteSection) {
      for (const entry of SECTION_MAP) {
        if (entry.section !== functionRouteSection) {
          const materialPenaltySections = new Set(["VII", "VIII", "IX", "XI", "XIII", "XIV", "XV"]);
          if (materialPenaltySections.has(entry.section)) {
            for (const ch of entry.chapters) penalizedSections.add(ch);
          }
        }
      }
    }

    chapterScores = chapterScores.map((cs) => {
      if (routedChapterCodes.has(cs.node.code)) {
        return { node: cs.node, score: Math.max(cs.score, 0.6) };
      }
      // Strongly demote chapters from penalized material sections
      if (penalizedSections.has(cs.node.code)) {
        return { node: cs.node, score: cs.score * 0.2 };
      }
      return cs;
    });
    chapterScores.sort((a, b) => b.score - a.score);
  }

  // Step 3: For each candidate chapter, score headings, then subheadings
  const allCandidates: Candidate[] = [];

  for (const { node: chapter, score: chScore } of chapterScores) {
    const sectionEntry = sections.find((s) => s.chapters.includes(chapter.code));
    const sScore = sectionEntry?.score ?? 0;

    // For function-classified chapters (e.g. 94=furniture), use function tokens
    // for heading selection (material determines subheading, not heading)
    const isFunction = FUNCTION_CHAPTERS.has(chapter.code);
    let headingScores: { node: HsNode; score: number }[];
    if (isFunction) {
      const functionTokens = tokens.filter((t) => !MATERIAL_TOKENS.has(t));
      const effectiveTokens = functionTokens.length > 0 ? functionTokens : tokens;
      const withSynonyms = expandTokensStrong(effectiveTokens);
      headingScores = scoreNodes(withSynonyms, chapter.children);
    } else {
      headingScores = scoreNodes(tokens, chapter.children);
    }

    for (const { node: heading, score: hScore } of headingScores) {
      if (heading.children.length === 0) {
        // Heading with no subheadings
        const descTokens = new Set(tokenize(heading.description));
        const matchedCount = stemMatchCount(tokens, descTokens);
        const confidence =
          WEIGHTS.section * sScore +
          WEIGHTS.chapter * chScore +
          WEIGHTS.heading * hScore +
          WEIGHTS.subheading * hScore;

        allCandidates.push({
          hscode: heading.code,
          description: heading.description,
          confidence,
          matchedTokenCount: matchedCount,
          reasoning: [
            `Section ${sectionEntry?.section ?? "?"}: ${sectionEntry?.title ?? ""}`,
            `Chapter ${chapter.code}: ${chapter.description}`,
            `Heading ${heading.code}: ${heading.description}`,
          ],
        });
        continue;
      }

      for (const sub of heading.children) {
        const subScore = scoreSubheading(tokens, sub);
        const descTokens = new Set(tokenize(sub.description));
        const matchedCount = stemMatchCount(tokens, descTokens);

        const confidence =
          WEIGHTS.section * sScore +
          WEIGHTS.chapter * chScore +
          WEIGHTS.heading * hScore +
          WEIGHTS.subheading * subScore;

        allCandidates.push({
          hscode: sub.code,
          description: sub.description,
          confidence,
          matchedTokenCount: matchedCount,
          reasoning: [
            `Section ${sectionEntry?.section ?? "?"}: ${sectionEntry?.title ?? ""}`,
            `Chapter ${chapter.code}: ${chapter.description}`,
            `Heading ${heading.code}: ${heading.description}`,
            `Subheading ${sub.code}: ${sub.description}`,
          ],
        });
      }
    }
  }

  // Step 4: GIR resolution and ranking
  let ranked = applyGir3a(allCandidates);
  ranked = applyGir3c(ranked);

  const top3 = ranked.slice(0, 3);
  const topConfidence = top3[0]?.confidence ?? 0;
  const needs_review = topConfidence < NEEDS_REVIEW_THRESHOLD;

  return { candidates: top3, needs_review };
}
