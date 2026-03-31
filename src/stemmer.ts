// src/stemmer.ts
// Simple English stemmer for HS description matching.

const STEM_EXCEPTIONS = new Set([
  "series", "species", "indices", "matrices", "vertices", "cookies",
  "leaves", "lives",
]);

export function simpleStem(word: string): string {
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

// Simple stem cache to avoid recomputation
const stemCache = new Map<string, string>();
export function cachedStem(word: string): string {
  let s = stemCache.get(word);
  if (s === undefined) {
    s = simpleStem(word);
    stemCache.set(word, s);
  }
  return s;
}

// Build a stem-based set for efficient matching
export function stemSet(tokens: string[]): Set<string> {
  const s = new Set<string>();
  for (const t of tokens) {
    s.add(t);
    s.add(cachedStem(t));
  }
  return s;
}

// Count how many input tokens match description tokens considering stems
export function stemMatchCount(inputTokens: string[], descTokens: Set<string>): number {
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
