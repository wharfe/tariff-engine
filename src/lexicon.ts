// src/lexicon.ts
// Synonym dictionaries and lexical classification data for HS matching.

// Strong synonyms: the synonym IS the HS term for this product
export const STRONG_SYNONYMS: Record<string, string[]> = {
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
  toothbrush: ["brush", "brushes"],
  scooter: ["motorcycles", "cycles"],
  tractor: ["tractors", "hauling"],
  truck: ["vehicles", "transport", "goods"],
  bus: ["vehicles", "transport", "passengers"],
  motorcycle: ["motorcycles", "cycles"],
  stroller: ["carriages", "baby"],
  car: ["vehicles", "motor"],
  sedan: ["vehicles", "motor"],
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
  tire: ["tyre", "tyres", "pneumatic"],
  tyre: ["tire", "tires", "pneumatic"],
  battery: ["accumulator", "accumulators"],
  laptop: ["computer", "notebook", "portable"],
  earphone: ["headphone", "headphones", "earphones"],
  headphone: ["earphone", "earphones", "headphones"],
  charger: ["converter", "adapter"],
  jeans: ["trousers", "denim"],
  cardigan: ["jerseys", "pullovers"],
  socks: ["hosiery", "stockings"],
  tracksuit: ["sportswear"],
  crib: ["furniture", "bed"],
  bookshelf: ["shelf", "furniture"],
  puzzle: ["puzzles", "games"],
  racket: ["racquet"],
  lighter: ["lighters"],
  comb: ["combs"],
  flask: ["flasks", "thermos"],
};

// Weak synonyms: broader associations (salmon→fish)
export const WEAK_SYNONYMS: Record<string, string[]> = {
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
export const WEAKENING_ADJACENTS: Record<string, string[]> = {
  pipe: ["fittings", "fitting"],
  tube: ["fittings", "fitting"],
  yarn: ["waste"],
};

// Function-word boost: these words indicate the product's function/use,
// which in HS takes priority over material (GIR 3(b) spirit).
export const FUNCTION_WORDS = new Set([
  // Furniture (Ch.94)
  "chair", "table", "desk", "bed", "seat", "sofa", "couch",
  "lamp", "lighting", "furniture", "cabinet", "shelf", "mattress",
  "bookshelf", "crib",
  // Toys/sports (Ch.95)
  "toy", "game", "brush", "broom",
  "puzzle", "racket", "tennis", "yoga", "swimming",
  // Miscellaneous (Ch.96)
  "toothbrush", "lighter", "comb", "flask", "pen", "pencil", "roller",
  // Footwear (Section XII)
  "shoe", "shoes", "boot", "boots", "sandal", "slipper", "sneaker", "footwear",
  // Clothing/garments (Section XI Ch.61-62)
  "shirt", "t-shirt", "dress", "trouser", "jacket", "coat", "garment", "clothing",
  "jeans", "cardigan", "socks", "tracksuit", "shorts", "blouse", "skirt",
  "tie", "necktie", "romper", "raincoat", "towel",
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
  // Rubber (Section VII Ch.40)
  "tire", "tyre",
  // Machinery (Section XVI Ch.84)
  "computer", "laptop", "engine", "pump", "centrifuge",
  "conditioner", "washing", "robot",
  // Electrical (Section XVI Ch.85)
  "battery", "motor", "cable", "charger", "earphone", "headphone",
  "camera", "solar", "bulb", "transformer", "breaker", "circuit",
]);

// Material words that should be deprioritized when function words are present
export const MATERIAL_TOKENS = new Set([
  "plastic", "plastics", "wood", "wooden", "metal", "iron", "steel",
  "copper", "aluminium", "aluminum", "glass", "ceramic", "rubber",
  "bamboo", "rattan", "leather", "stone",
]);

// Sections classified as material-based (plastics, wood, stone/ceramic, metals)
export const MATERIAL_SECTIONS = new Set(["VII", "IX", "XIII", "XV"]);

// Chapters where function/product-type determines the heading, not material
export const FUNCTION_CHAPTERS = new Set(["94", "95", "96"]);

// Expand input tokens with strong synonyms (near-equivalents)
export function expandTokensStrong(tokens: string[]): string[] {
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
export function expandTokensAll(tokens: string[]): string[] {
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
