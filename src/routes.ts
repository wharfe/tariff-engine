// src/routes.ts
// Function-based section and product-based chapter routing tables.

// Function words that route to specific sections, overriding material-based classification.
// Maps function words to their correct section (used to boost the right section).
export const FUNCTION_SECTION_ROUTES: Record<string, string> = {
  // Furniture → Section XX
  chair: "XX", table: "XX", desk: "XX", bed: "XX", sofa: "XX",
  couch: "XX", lamp: "XX", mattress: "XX", furniture: "XX",
  bookshelf: "XX", crib: "XX", shelf: "XX",
  // Footwear → Section XII
  shoe: "XII", shoes: "XII", boot: "XII", boots: "XII",
  sandal: "XII", slipper: "XII", sneaker: "XII", footwear: "XII",
  // Clothing → Section XI (but chapters 61-62 for garments, not raw textile chapters)
  shirt: "XI", "t-shirt": "XI", dress: "XI", trouser: "XI",
  jacket: "XI", coat: "XI", garment: "XI", clothing: "XI",
  jeans: "XI", cardigan: "XI", socks: "XI", tracksuit: "XI",
  shorts: "XI", blouse: "XI", skirt: "XI", necktie: "XI", tie: "XI",
  romper: "XI", raincoat: "XI", towel: "XI",
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
  // Rubber → Section VII
  tire: "VII", tyre: "VII", rubber: "VII",
  // Machinery → Section XVI
  computer: "XVI", laptop: "XVI", engine: "XVI", pump: "XVI",
  conditioner: "XVI", washing: "XVI", centrifuge: "XVI", robot: "XVI",
  // Electrical → Section XVI
  battery: "XVI", motor: "XVI", cable: "XVI", transformer: "XVI",
  charger: "XVI", earphone: "XVI", headphone: "XVI", camera: "XVI",
  solar: "XVI", bulb: "XVI", breaker: "XVI",
  // Toys/sports → Section XX
  puzzle: "XX", racket: "XX", tennis: "XX", yoga: "XX", swimming: "XX",
  // Misc → Section XX
  lighter: "XX", comb: "XX", flask: "XX", pen: "XX",
  toothbrush: "XX", roller: "XX",
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
  toothbrush: ["96"],
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
  shirt: ["61", "62"],
  "t-shirt": ["61"],
  mug: ["69"],
  foil: ["76"],
  antique: ["97"],
  painting: ["97"],
  // Ch.39 Plastics
  polyethylene: ["39"], polypropylene: ["39"], pvc: ["39"], acrylic: ["39"],
  polycarbonate: ["39"], pellets: ["39"],
  // Ch.40 Rubber
  tire: ["40"], tyre: ["40"], rubber: ["40"], latex: ["40"], gloves: ["40"],
  // Ch.61/62 Apparel
  dress: ["61", "62"], trouser: ["61", "62"], trousers: ["61", "62"],
  jacket: ["61", "62"], coat: ["61", "62"], jeans: ["62"],
  cardigan: ["61"], socks: ["61"], shorts: ["61", "62"],
  blouse: ["61", "62"], skirt: ["61", "62"], necktie: ["62"],
  tie: ["62"], tracksuit: ["61"], romper: ["61"], raincoat: ["62"],
  towel: ["63"],
  // Ch.84 Machinery
  computer: ["84"], laptop: ["84"], conditioner: ["84"], washer: ["84"],
  washing: ["84"], pump: ["84"], bearing: ["84"], centrifuge: ["84"],
  sewing: ["84"], engine: ["84"], robot: ["84"],
  // Ch.85 Electrical
  battery: ["85"], motor: ["85"], cable: ["85"], transformer: ["85"],
  charger: ["85"], earphone: ["85"], headphone: ["85"], speaker: ["85"],
  camera: ["85"], solar: ["85"], breaker: ["85"], circuit: ["85"],
  bulb: ["85"],
  // Ch.94 Furniture
  bookshelf: ["94"], crib: ["94"], shelf: ["94"],
  // Ch.95 Toys/Sports
  puzzle: ["95"], racket: ["95"], tennis: ["95"], yoga: ["95"],
  swimming: ["95"], blocks: ["95"], train: ["95"],
  // Ch.96 Miscellaneous
  lighter: ["96"], comb: ["96"], roller: ["96"], flask: ["96"],
  pen: ["96"], pencil: ["96"],
};
