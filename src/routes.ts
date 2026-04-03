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
  sandal: "XII", slipper: "XII", sneaker: "XII", sneakers: "XII",
  footwear: "XII", flipflop: "XII",
  // Clothing → Section XI (but chapters 61-62 for garments, not raw textile chapters)
  shirt: "XI", "t-shirt": "XI", dress: "XI", trouser: "XI",
  jacket: "XI", coat: "XI", garment: "XI", clothing: "XI",
  jeans: "XI", cardigan: "XI", socks: "XI", tracksuit: "XI",
  shorts: "XI", blouse: "XI", skirt: "XI", necktie: "XI", tie: "XI",
  romper: "XI", raincoat: "XI", towel: "XI",
  // Bags/Leather → Section VIII
  backpack: "VIII", suitcase: "VIII", briefcase: "VIII",
  wallet: "VIII", purse: "VIII", handbag: "VIII", belt: "VIII",
  // Jewelry → Section XIV
  necklace: "XIV", bracelet: "XIV", earring: "XIV",
  diamond: "XIV", pearl: "XIV", gold: "XIV",
  // Cutlery/knives → Section XV (Ch.82)
  knife: "XV", cutlery: "XV",
  // Tableware/Ceramics → Section XIII
  mug: "XIII", cup: "XIII",
  ceramic: "XIII", porcelain: "XIII", tile: "XIII",
  // Pharma → Section VI
  aspirin: "VI", insulin: "VI", vitamin: "VI", bandage: "VI",
  // Cosmetics → Section VI
  perfume: "VI", shampoo: "VI", lipstick: "VI", sunscreen: "VI", toothpaste: "VI",
  // Wood → Section IX
  lumber: "IX", charcoal: "IX",
  // Paper → Section X
  paper: "X", cardboard: "X", napkin: "X",
  // Iron/Steel → Section XV
  nail: "XV", nails: "XV", chain: "XV", pot: "XV",
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
  aspirin: ["30"], insulin: ["30"], vitamin: ["30"], bandage: ["30"],
  medicine: ["30"],
  tablet: ["30"],
  tablets: ["30"],
  coffee: ["09"],
  // Ch.33 Cosmetics
  perfume: ["33"], shampoo: ["33"], lipstick: ["33"], sunscreen: ["33"], toothpaste: ["33"],
  // Ch.42 Leather/Bags
  handbag: ["42"], belt: ["42"], collar: ["42"],
  // Ch.44 Wood
  plywood: ["44"], lumber: ["44"], chopsticks: ["44"], flooring: ["44"], charcoal: ["44"],
  // Ch.48 Paper
  paper: ["48"], cardboard: ["48"], napkin: ["48"], toilet: ["48"],
  // Ch.63 Textile articles
  tent: ["63"], bedsheet: ["63"],
  // Ch.64 Footwear
  sandal: ["64"], sneaker: ["64"], sneakers: ["64"], flipflop: ["64"],
  // Ch.69 Ceramics
  ceramic: ["69"], porcelain: ["69"], tile: ["69"],
  // Ch.71 Jewelry
  diamond: ["71"], pearl: ["71"], gold: ["71"],
  // Ch.73 Iron/Steel
  nail: ["73"], nails: ["73"], chain: ["73"], wire: ["73"], pot: ["73"],
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
  // Ch.61/62 Apparel — knitted/woven discriminator
  knitted: ["61"], knit: ["61"], crocheted: ["61"],
  woven: ["62"],
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
