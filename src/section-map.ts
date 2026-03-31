// Static mapping table of all 21 HS sections with associated chapters and keywords

export interface SectionEntry {
  section: string;
  title: string;
  keywords: string[];
  chapters: string[];
}

export const SECTION_MAP: SectionEntry[] = [
  {
    section: "I",
    title: "Live animals; animal products",
    keywords: ["animal", "live", "meat", "beef", "pork", "chicken", "fish", "seafood", "dairy", "milk", "egg", "honey", "horse", "cattle", "swine", "poultry", "crustacean", "mollusc", "salmon", "shrimp", "tuna", "bovine", "lamb", "mutton"],
    chapters: ["01", "02", "03", "04", "05"],
  },
  {
    section: "II",
    title: "Vegetable products",
    keywords: ["vegetable", "plant", "fruit", "cereal", "grain", "rice", "wheat", "coffee", "tea", "spice", "seed", "flower", "tree", "straw", "fodder"],
    chapters: ["06", "07", "08", "09", "10", "11", "12", "13", "14"],
  },
  {
    section: "III",
    title: "Animal or vegetable fats and oils",
    keywords: ["fat", "oil", "wax", "grease", "tallow", "lard", "margarine", "olive", "palm", "soybean"],
    chapters: ["15"],
  },
  {
    section: "IV",
    title: "Prepared foodstuffs; beverages, spirits and vinegar; tobacco",
    keywords: ["food", "beverage", "drink", "alcohol", "wine", "beer", "spirit", "tobacco", "cigarette", "sugar", "chocolate", "cocoa", "bread", "pasta", "vinegar", "sauce", "juice"],
    chapters: ["16", "17", "18", "19", "20", "21", "22", "23", "24"],
  },
  {
    section: "V",
    title: "Mineral products",
    keywords: ["mineral", "salt", "sulphur", "earth", "stone", "cement", "ore", "coal", "petroleum", "oil", "gas", "fuel", "bitumen"],
    chapters: ["25", "26", "27"],
  },
  {
    section: "VI",
    title: "Products of the chemical or allied industries",
    keywords: ["chemical", "pharmaceutical", "drug", "medicine", "fertilizer", "dye", "pigment", "paint", "varnish", "soap", "detergent", "cosmetic", "perfume", "essential-oil", "photographic", "explosive"],
    chapters: ["28", "29", "30", "31", "32", "33", "34", "35", "36", "37", "38"],
  },
  {
    section: "VII",
    title: "Plastics and articles thereof; rubber and articles thereof",
    keywords: ["plastic", "rubber", "polymer", "resin", "polyethylene", "pvc", "silicone", "tire", "tyre", "tube", "hose"],
    chapters: ["39", "40"],
  },
  {
    section: "VIII",
    title: "Raw hides and skins, leather, furskins and articles thereof",
    keywords: ["leather", "hide", "skin", "fur", "furskin", "saddlery", "handbag", "bag", "luggage", "travel", "gut"],
    chapters: ["41", "42", "43"],
  },
  {
    section: "IX",
    title: "Wood and articles of wood; cork; manufactures of straw",
    keywords: ["wood", "wooden", "timber", "lumber", "plywood", "veneer", "cork", "straw", "bamboo", "rattan", "basket", "charcoal"],
    chapters: ["44", "45", "46"],
  },
  {
    section: "X",
    title: "Pulp of wood; paper and paperboard",
    keywords: ["paper", "pulp", "paperboard", "cardboard", "newspaper", "book", "printed", "printing", "wallpaper"],
    chapters: ["47", "48", "49"],
  },
  {
    section: "XI",
    title: "Textiles and textile articles",
    keywords: ["textile", "fabric", "cotton", "wool", "silk", "synthetic", "yarn", "thread", "woven", "knitted", "carpet", "rug", "clothing", "garment", "shirt", "trouser", "dress", "suit", "linen", "nylon", "polyester", "fibre", "fiber"],
    chapters: ["50", "51", "52", "53", "54", "55", "56", "57", "58", "59", "60", "61", "62", "63"],
  },
  {
    section: "XII",
    title: "Footwear, headgear, umbrellas, walking-sticks, whips",
    keywords: ["footwear", "shoe", "boot", "sandal", "slipper", "hat", "headgear", "umbrella", "parasol", "walking-stick", "whip"],
    chapters: ["64", "65", "66", "67"],
  },
  {
    section: "XIII",
    title: "Articles of stone, plaster, cement, asbestos, mica; ceramic products; glass",
    keywords: ["stone", "plaster", "cement", "asbestos", "mica", "ceramic", "porcelain", "glass", "glassware", "mirror", "brick", "tile"],
    chapters: ["68", "69", "70"],
  },
  {
    section: "XIV",
    title: "Natural or cultured pearls, precious or semi-precious stones, precious metals",
    keywords: ["pearl", "diamond", "gem", "gemstone", "precious", "gold", "silver", "platinum", "jewellery", "jewelry", "coin"],
    chapters: ["71"],
  },
  {
    section: "XV",
    title: "Base metals and articles of base metals",
    keywords: ["metal", "iron", "steel", "copper", "aluminium", "aluminum", "nickel", "zinc", "tin", "lead", "wire", "nail", "screw", "bolt", "nut", "pipe", "tube", "chain", "spring", "needle", "stove", "radiator", "bar", "rod", "plate", "sheet", "coil"],
    chapters: ["72", "73", "74", "75", "76", "78", "79", "80", "81", "82", "83"],
  },
  {
    section: "XVI",
    title: "Machinery and mechanical appliances; electrical equipment",
    keywords: ["machine", "machinery", "mechanical", "engine", "motor", "pump", "compressor", "turbine", "electrical", "electronic", "computer", "laptop", "telephone", "television", "tv", "radio", "battery", "semiconductor", "circuit", "transformer", "generator", "refrigerator", "washing", "printer", "camera", "microwave", "air-conditioning"],
    chapters: ["84", "85"],
  },
  {
    section: "XVII",
    title: "Vehicles, aircraft, vessels and associated transport equipment",
    keywords: ["vehicle", "car", "automobile", "truck", "bus", "motorcycle", "bicycle", "railway", "train", "aircraft", "airplane", "helicopter", "ship", "boat", "vessel", "trailer", "carriage"],
    chapters: ["86", "87", "88", "89"],
  },
  {
    section: "XVIII",
    title: "Optical, photographic, cinematographic, measuring, checking, precision, medical or surgical instruments; clocks and watches; musical instruments",
    keywords: ["optical", "lens", "microscope", "telescope", "photographic", "measuring", "instrument", "medical", "surgical", "clock", "watch", "musical", "piano", "guitar", "violin"],
    chapters: ["90", "91", "92"],
  },
  {
    section: "XIX",
    title: "Arms and ammunition; parts and accessories thereof",
    keywords: ["arm", "weapon", "gun", "rifle", "pistol", "ammunition", "bomb", "grenade", "sword"],
    chapters: ["93"],
  },
  {
    section: "XX",
    title: "Miscellaneous manufactured articles",
    keywords: ["furniture", "bed", "mattress", "lamp", "lighting", "prefabricated", "toy", "game", "sport", "brush", "broom", "button", "pen", "pencil", "chair", "table", "desk", "seat", "dining", "wooden", "cabinet", "shelf", "sofa", "couch"],
    chapters: ["94", "95", "96"],
  },
  {
    section: "XXI",
    title: "Works of art, collectors' pieces and antiques",
    keywords: ["art", "painting", "sculpture", "statue", "antique", "collector", "stamp", "collection"],
    chapters: ["97"],
  },
];
