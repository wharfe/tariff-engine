// src/routes.ts
// Function-based section and product-based chapter routing tables.

// Function words that route to specific sections, overriding material-based classification.
// Maps function words to their correct section (used to boost the right section).
export const FUNCTION_SECTION_ROUTES: Record<string, string> = {
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
  // Vehicles → Section XVII
  car: "XVII", vehicle: "XVII", truck: "XVII", bus: "XVII",
  tractor: "XVII", motorcycle: "XVII", stroller: "XVII", sedan: "XVII",
};

// Direct chapter routing: when specific product-type words are present,
// force consideration of specific chapters (bypasses pure keyword scoring).
export const PRODUCT_CHAPTER_ROUTES: Record<string, string[]> = {
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
  tractor: ["87"],
  bus: ["87"],
  truck: ["87"],
  motorcycle: ["87"],
  stroller: ["87"],
  car: ["87"],
  sedan: ["87"],
  vehicle: ["87"],
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
