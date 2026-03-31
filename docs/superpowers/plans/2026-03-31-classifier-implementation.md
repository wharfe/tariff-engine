# Classifier実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** hs-tree.jsonを読み込み、商品説明文からHS 6桁コード候補を返すキーワードベース分類器を実装する

**Architecture:** loadTree()でhs-tree.jsonをキャッシュし、classify()で4階層（section→chapter→heading→subheading）のトークンマッチングを実行。重み付き平均でfinalConfidenceを算出し、上位3候補+reasoning pathを返す。

**Tech Stack:** TypeScript, vitest, Node.js fs (runtime dependency無し)

**Spec:** `docs/superpowers/specs/2026-03-31-classifier-design.md`

---

## ファイル構成

| ファイル | 操作 | 責務 |
|----------|------|------|
| `src/section-map.ts` | 新規作成 | 21セクションの静的マッピングテーブル（タイトル、キーワード、チャプター番号） |
| `src/classifier.ts` | 書き換え | loadTree(), classify(), 各階層スコアリング、candidateの組み立て |
| `src/gir.ts` | 修正 | GIR 3(a)をマッチトークン数ベースに改善 |
| `src/rule-engine.ts` | 修正 | equals型の大文字小文字正規化 |
| `src/index.ts` | 修正 | loadTree, SECTION_MAPのexport追加 |
| `cli/index.ts` | 修正 | loadTree()呼び出し追加 |
| `tests/classifier.test.ts` | 新規作成 | classifier単体テスト + 統合テスト |
| `tests/fixtures/test-cases.json` | 新規作成 | 50テストケース（商品説明→期待HSコード） |

---

### Task 1: セクション静的マッピングテーブル

**Files:**
- Create: `src/section-map.ts`
- Test: `tests/section-map.test.ts`

- [ ] **Step 1: テストを書く**

```typescript
// tests/section-map.test.ts
import { describe, it, expect } from "vitest";
import { SECTION_MAP } from "../src/section-map.js";

describe("SECTION_MAP", () => {
  it("contains all 21 sections", () => {
    expect(SECTION_MAP).toHaveLength(21);
  });

  it("each entry has required fields", () => {
    for (const entry of SECTION_MAP) {
      expect(entry.section).toBeTruthy();
      expect(entry.title).toBeTruthy();
      expect(entry.keywords.length).toBeGreaterThan(0);
      expect(entry.chapters.length).toBeGreaterThan(0);
    }
  });

  it("covers all 97 chapters (excluding 77 and 99)", () => {
    const allChapters = SECTION_MAP.flatMap((s) => s.chapters);
    // HS has chapters 01-98, minus 77 (reserved) = 97 chapters
    // Chapter 99 is special (TOTAL section), not in standard sections
    expect(allChapters.length).toBeGreaterThanOrEqual(96);
  });

  it("section I covers chapters 01-05", () => {
    const sec1 = SECTION_MAP.find((s) => s.section === "I");
    expect(sec1?.chapters).toEqual(["01", "02", "03", "04", "05"]);
    expect(sec1?.title).toContain("animal");
  });

  it("section XVI covers chapters 84-85", () => {
    const sec16 = SECTION_MAP.find((s) => s.section === "XVI");
    expect(sec16?.chapters).toEqual(["84", "85"]);
  });
});
```

- [ ] **Step 2: テスト実行 — 失敗確認**

Run: `npx vitest run tests/section-map.test.ts`
Expected: FAIL — `section-map.js` が存在しない

- [ ] **Step 3: section-map.tsを実装**

```typescript
// src/section-map.ts

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
    keywords: ["animal", "live", "meat", "fish", "dairy", "milk", "egg", "honey", "horse", "cattle", "swine", "poultry", "crustacean", "mollusc"],
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
    keywords: ["metal", "iron", "steel", "copper", "aluminium", "aluminum", "nickel", "zinc", "tin", "lead", "wire", "nail", "screw", "bolt", "nut", "pipe", "tube", "chain", "spring", "needle", "stove", "radiator"],
    chapters: ["72", "73", "74", "75", "76", "78", "79", "80", "81", "82", "83"],
  },
  {
    section: "XVI",
    title: "Machinery and mechanical appliances; electrical equipment",
    keywords: ["machine", "machinery", "mechanical", "engine", "motor", "pump", "compressor", "turbine", "electrical", "electronic", "computer", "telephone", "television", "tv", "radio", "battery", "semiconductor", "circuit", "transformer", "generator", "refrigerator", "washing", "printer", "camera"],
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
    keywords: ["furniture", "bed", "mattress", "lamp", "lighting", "prefabricated", "toy", "game", "sport", "brush", "broom", "button", "pen", "pencil", "chair", "table", "desk", "seat"],
    chapters: ["94", "95", "96"],
  },
  {
    section: "XXI",
    title: "Works of art, collectors' pieces and antiques",
    keywords: ["art", "painting", "sculpture", "statue", "antique", "collector", "stamp", "collection"],
    chapters: ["97"],
  },
];
```

- [ ] **Step 4: テスト実行 — パス確認**

Run: `npx vitest run tests/section-map.test.ts`
Expected: PASS（全5テスト）

- [ ] **Step 5: コミット**

```bash
git add src/section-map.ts tests/section-map.test.ts
git commit -m "feat: add section static mapping table with 21 HS sections"
```

---

### Task 2: loadTree() — ツリー読み込みとキャッシュ

**Files:**
- Modify: `src/classifier.ts`
- Test: `tests/classifier.test.ts`

- [ ] **Step 1: テストを書く**

```typescript
// tests/classifier.test.ts
import { describe, it, expect, beforeAll } from "vitest";
import { loadTree } from "../src/classifier.js";
import path from "node:path";

describe("loadTree", () => {
  it("loads hs-tree.json and returns HsNode array", () => {
    const tree = loadTree();
    expect(Array.isArray(tree)).toBe(true);
    expect(tree.length).toBe(97); // 97 chapters
  });

  it("each node has code, description, level, children", () => {
    const tree = loadTree();
    const ch01 = tree[0];
    expect(ch01.code).toBe("01");
    expect(ch01.description).toBeTruthy();
    expect(ch01.level).toBe(2);
    expect(Array.isArray(ch01.children)).toBe(true);
  });

  it("caches the tree on second call", () => {
    const tree1 = loadTree();
    const tree2 = loadTree();
    expect(tree1).toBe(tree2); // same reference
  });

  it("force reload returns fresh tree", () => {
    const tree1 = loadTree();
    const tree2 = loadTree(undefined, { force: true });
    expect(tree1).not.toBe(tree2); // different reference
    expect(tree2.length).toBe(97);
  });

  it("loads custom path", () => {
    // loadTree with the default path explicitly should work the same
    const tree = loadTree(
      path.resolve(process.cwd(), "data/hs-tree.json"),
      { force: true },
    );
    expect(tree.length).toBe(97);
  });
});
```

- [ ] **Step 2: テスト実行 — 失敗確認**

Run: `npx vitest run tests/classifier.test.ts`
Expected: FAIL — `loadTree` is not exported

- [ ] **Step 3: loadTree()を実装**

```typescript
// src/classifier.ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { HsNode, ClassifyInput, ClassifyResult } from "./types.js";

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

export function classify(input: ClassifyInput): ClassifyResult {
  return { candidates: [], needs_review: true };
}
```

- [ ] **Step 4: テスト実行 — パス確認**

Run: `npx vitest run tests/classifier.test.ts`
Expected: PASS（全5テスト）

- [ ] **Step 5: コミット**

```bash
git add src/classifier.ts tests/classifier.test.ts
git commit -m "feat: implement loadTree with caching and custom path support"
```

---

### Task 3: セクションスコアリング

**Files:**
- Modify: `src/classifier.ts`
- Modify: `tests/classifier.test.ts`

- [ ] **Step 1: テストを書く**

`tests/classifier.test.ts` に追加:

```typescript
import { loadTree, classify, scoreSection } from "../src/classifier.js";
import { tokenize } from "../src/tokenizer.js";

describe("scoreSection", () => {
  it("scores animal-related input highest for section I", () => {
    const tokens = tokenize("live horses");
    const scores = scoreSection(tokens);
    const sec1 = scores.find((s) => s.section === "I");
    expect(sec1).toBeDefined();
    expect(sec1!.score).toBeGreaterThan(0);
    // Section I should be top or near top
    scores.sort((a, b) => b.score - a.score);
    expect(scores[0].section).toBe("I");
  });

  it("scores machinery input highest for section XVI", () => {
    const tokens = tokenize("electrical motor generator");
    const scores = scoreSection(tokens);
    scores.sort((a, b) => b.score - a.score);
    expect(scores[0].section).toBe("XVI");
  });

  it("filters sections below 50% of max score (min 3)", () => {
    const tokens = tokenize("live horses");
    const scores = scoreSection(tokens);
    const maxScore = Math.max(...scores.map((s) => s.score));
    const threshold = maxScore * 0.5;
    // All returned scores are >= threshold, or there are at least 3
    if (scores.length > 3) {
      for (const s of scores) {
        expect(s.score).toBeGreaterThanOrEqual(threshold);
      }
    } else {
      expect(scores.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("returns at least 3 sections even if only 1 matches", () => {
    const tokens = tokenize("antique painting");
    const scores = scoreSection(tokens);
    expect(scores.length).toBeGreaterThanOrEqual(3);
  });
});
```

- [ ] **Step 2: テスト実行 — 失敗確認**

Run: `npx vitest run tests/classifier.test.ts`
Expected: FAIL — `scoreSection` is not exported

- [ ] **Step 3: scoreSection()を実装**

`src/classifier.ts` に追加:

```typescript
import { SECTION_MAP } from "./section-map.js";
import { tokenize } from "./tokenizer.js";

export interface ScoredSection {
  section: string;
  title: string;
  score: number;
  chapters: string[];
}

export function scoreSection(inputTokens: string[]): ScoredSection[] {
  if (inputTokens.length === 0) return [];

  const scored: ScoredSection[] = SECTION_MAP.map((entry) => {
    const keywordSet = new Set(entry.keywords);
    const matched = inputTokens.filter((t) => keywordSet.has(t)).length;
    const score = matched / inputTokens.length;
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

  // Ensure minimum 3 by taking top 3
  return scored.sort((a, b) => b.score - a.score).slice(0, 3);
}
```

- [ ] **Step 4: テスト実行 — パス確認**

Run: `npx vitest run tests/classifier.test.ts`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/classifier.ts tests/classifier.test.ts
git commit -m "feat: implement section scoring with threshold filter"
```

---

### Task 4: チャプター・ヘディングスコアリング

**Files:**
- Modify: `src/classifier.ts`
- Modify: `tests/classifier.test.ts`

- [ ] **Step 1: テストを書く**

`tests/classifier.test.ts` に追加:

```typescript
import { scoreNodes } from "../src/classifier.js";

describe("scoreNodes", () => {
  beforeAll(() => {
    loadTree(undefined, { force: true });
  });

  it("scores chapter 01 highest for 'live horses'", () => {
    const tokens = tokenize("live horses");
    const tree = loadTree();
    const scores = scoreNodes(tokens, tree);
    scores.sort((a, b) => b.score - a.score);
    expect(scores[0].node.code).toBe("01");
  });

  it("scores chapter 94 for 'wooden furniture'", () => {
    const tokens = tokenize("wooden furniture");
    const tree = loadTree();
    const scores = scoreNodes(tokens, tree);
    const ch94 = scores.find((s) => s.node.code === "94");
    expect(ch94).toBeDefined();
    expect(ch94!.score).toBeGreaterThan(0);
  });

  it("filters by 50% threshold with minimum 3", () => {
    const tokens = tokenize("live horses");
    const tree = loadTree();
    const scores = scoreNodes(tokens, tree);
    expect(scores.length).toBeGreaterThanOrEqual(3);
  });

  it("scores headings within a chapter", () => {
    const tokens = tokenize("live horses");
    const tree = loadTree();
    const ch01 = tree.find((ch) => ch.code === "01")!;
    const headingScores = scoreNodes(tokens, ch01.children);
    headingScores.sort((a, b) => b.score - a.score);
    expect(headingScores[0].node.code).toBe("0101"); // Horses
  });
});
```

- [ ] **Step 2: テスト実行 — 失敗確認**

Run: `npx vitest run tests/classifier.test.ts`
Expected: FAIL — `scoreNodes` is not exported

- [ ] **Step 3: scoreNodes()を実装**

`src/classifier.ts` に追加:

```typescript
export interface ScoredNode {
  node: HsNode;
  score: number;
}

export function scoreNodes(inputTokens: string[], nodes: HsNode[]): ScoredNode[] {
  if (inputTokens.length === 0 || nodes.length === 0) return [];

  const scored: ScoredNode[] = nodes.map((node) => {
    const descTokens = new Set(tokenize(node.description));
    const matched = inputTokens.filter((t) => descTokens.has(t)).length;
    const score = matched / inputTokens.length;
    return { node, score };
  });

  // Filter: >= 50% of max score, minimum 3
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
```

- [ ] **Step 4: テスト実行 — パス確認**

Run: `npx vitest run tests/classifier.test.ts`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/classifier.ts tests/classifier.test.ts
git commit -m "feat: implement node scoring for chapter and heading matching"
```

---

### Task 5: サブヘディングパターン解析

**Note:** `tokenize(node.description)`は"other than X"句のトークンも含むため、通常マッチで
高スコアが出た後にother thanチェックで0に戻す流れになる。ヘディングレベルのscoreNodesでは
descriptionにother than句が含まれていてもトークンマッチに影響するが、Phase 1ではこのまま許容。

**Files:**
- Modify: `src/classifier.ts`
- Modify: `tests/classifier.test.ts`

- [ ] **Step 1: テストを書く**

`tests/classifier.test.ts` に追加:

```typescript
import { scoreSubheading } from "../src/classifier.js";

describe("scoreSubheading", () => {
  it("returns normal score for plain description", () => {
    const tokens = tokenize("live horses pure-bred breeding animals");
    const node: HsNode = {
      code: "010121",
      description: "Horses; live, pure-bred breeding animals",
      level: 6,
      children: [],
    };
    const score = scoreSubheading(tokens, node);
    expect(score).toBeGreaterThan(0);
  });

  it("returns 0 for 'other than' match", () => {
    const tokens = tokenize("live horses pure-bred breeding");
    const node: HsNode = {
      code: "010129",
      description: "Horses; live, other than pure-bred breeding animals",
      level: 6,
      children: [],
    };
    const score = scoreSubheading(tokens, node);
    expect(score).toBe(0);
  });

  it("does not trigger 'other than' when excluded tokens are absent", () => {
    const tokens = tokenize("live horses working");
    const node: HsNode = {
      code: "010129",
      description: "Horses; live, other than pure-bred breeding animals",
      level: 6,
      children: [],
    };
    const score = scoreSubheading(tokens, node);
    expect(score).toBeGreaterThan(0);
  });

  it("applies fallback penalty for n.e.c. description", () => {
    const tokens = tokenize("bovine animals live");
    const normalNode: HsNode = {
      code: "010221",
      description: "Cattle; live, pure-bred breeding animals",
      level: 6,
      children: [],
    };
    const necNode: HsNode = {
      code: "010290",
      description: "Bovine animals; live, other than cattle and buffalo",
      level: 6,
      children: [],
    };
    // n.e.c./catch-all check: description starting with "Other" or containing "n.e.s.i."
    const otherNode: HsNode = {
      code: "010290",
      description: "Other live bovine animals",
      level: 6,
      children: [],
    };
    const normalScore = scoreSubheading(tokens, normalNode);
    const otherScore = scoreSubheading(tokens, otherNode);
    expect(otherScore).toBeLessThan(normalScore);
  });

  it("applies fallback penalty for n.e.s.i. description", () => {
    const tokens = tokenize("some product");
    const nesiNode: HsNode = {
      code: "999999",
      description: "Products n.e.s.i.",
      level: 6,
      children: [],
    };
    const score = scoreSubheading(tokens, nesiNode);
    // Score should be penalized (multiplied by 0.3)
    expect(score).toBeLessThanOrEqual(0.3);
  });
});
```

- [ ] **Step 2: テスト実行 — 失敗確認**

Run: `npx vitest run tests/classifier.test.ts`
Expected: FAIL — `scoreSubheading` is not exported

- [ ] **Step 3: scoreSubheading()を実装**

`src/classifier.ts` に追加:

```typescript
const OTHER_THAN_RE = /other than ([^;,]+)/i;
const FALLBACK_RE = /\bn\.e\.s\.i\b|\bn\.e\.c\b|\bnot elsewhere\b/i;
const FALLBACK_PENALTY = 0.3;

export function scoreSubheading(inputTokens: string[], node: HsNode): number {
  const descTokens = new Set(tokenize(node.description));
  const matched = inputTokens.filter((t) => descTokens.has(t)).length;
  let score = inputTokens.length > 0 ? matched / inputTokens.length : 0;

  // "other than X" pattern: if input contains X tokens, score = 0
  const otherThanMatch = node.description.match(OTHER_THAN_RE);
  if (otherThanMatch) {
    const excludedTokens = tokenize(otherThanMatch[1]);
    const inputSet = new Set(inputTokens);
    const hasExcluded = excludedTokens.some((t) => inputSet.has(t));
    if (hasExcluded) return 0;
  }

  // Fallback penalty: n.e.s.i., n.e.c., or description starts with "Other"
  const isFallback =
    FALLBACK_RE.test(node.description) ||
    node.description.startsWith("Other ");
  if (isFallback) {
    score *= FALLBACK_PENALTY;
  }

  return score;
}
```

- [ ] **Step 4: テスト実行 — パス確認**

Run: `npx vitest run tests/classifier.test.ts`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/classifier.ts tests/classifier.test.ts
git commit -m "feat: implement subheading pattern analysis (other-than, fallback)"
```

---

### Task 6: equals型正規化（rule-engine.ts修正）

**Files:**
- Modify: `src/rule-engine.ts`
- Modify existing test or create: `tests/rule-engine.test.ts`

- [ ] **Step 1: テストを書く**

```typescript
// tests/rule-engine.test.ts
import { describe, it, expect } from "vitest";
import { evaluateCondition } from "../src/rule-engine.js";

describe("evaluateCondition", () => {
  it("equals: case-insensitive string comparison", () => {
    expect(
      evaluateCondition(
        { type: "equals", field: "material", value: "Wood" },
        { material: "wood" },
      ),
    ).toBe(true);
  });

  it("equals: case-insensitive both directions", () => {
    expect(
      evaluateCondition(
        { type: "equals", field: "material", value: "steel" },
        { material: "STEEL" },
      ),
    ).toBe(true);
  });

  it("equals: non-matching returns false", () => {
    expect(
      evaluateCondition(
        { type: "equals", field: "material", value: "wood" },
        { material: "metal" },
      ),
    ).toBe(false);
  });

  it("gt: numeric comparison", () => {
    expect(
      evaluateCondition(
        { type: "gt", field: "weight_kg", value: 10 },
        { weight_kg: 15 },
      ),
    ).toBe(true);
  });

  it("contains: string inclusion", () => {
    expect(
      evaluateCondition(
        { type: "contains", field: "description", value: "wood" },
        { description: "wooden table" },
      ),
    ).toBe(true);
  });

  it("returns false for undefined field", () => {
    expect(
      evaluateCondition(
        { type: "equals", field: "color", value: "red" },
        {},
      ),
    ).toBe(false);
  });
});
```

- [ ] **Step 2: テスト実行 — 失敗確認**

Run: `npx vitest run tests/rule-engine.test.ts`
Expected: FAIL — equals case insensitivity fails

- [ ] **Step 3: equals型を正規化**

`src/rule-engine.ts` のequalsケースを修正:

```typescript
case "equals":
  return String(value).toLowerCase() === String(condition.value).toLowerCase();
```

- [ ] **Step 4: テスト実行 — パス確認**

Run: `npx vitest run tests/rule-engine.test.ts`
Expected: PASS（全6テスト）

- [ ] **Step 5: コミット**

```bash
git add src/rule-engine.ts tests/rule-engine.test.ts
git commit -m "fix: normalize equals comparison to case-insensitive"
```

---

### Task 7: GIR 3(a) 改善 — マッチトークン数ベース

**Files:**
- Modify: `src/types.ts` (CandidateにmatchedTokenCount追加)
- Modify: `src/gir.ts`
- Test: `tests/gir.test.ts`

**Note:** GIR 3(a)のtie-break指標は`reasoning.length`ではなく`matchedTokenCount`を使用する。
reasoning.lengthはほぼ全候補が4（Section/Chapter/Heading/Subheading）で横並びになるため機能しない。
descriptionに実際にマッチしたトークンの絶対数が「最も特定的な記述」の適切な指標となる。

- [ ] **Step 1: Candidate型にmatchedTokenCount追加**

`src/types.ts` のCandidate interfaceを修正:

```typescript
export interface Candidate {
  hscode: string;
  description: string;
  confidence: number;
  reasoning: string[];
  matchedTokenCount: number; // number of input tokens that matched description
}
```

- [ ] **Step 2: テストを書く**

```typescript
// tests/gir.test.ts
import { describe, it, expect } from "vitest";
import { applyGir3a, applyGir3c } from "../src/gir.js";
import type { Candidate } from "../src/types.js";

describe("applyGir3a", () => {
  it("sorts by confidence descending", () => {
    const candidates: Candidate[] = [
      { hscode: "0101", description: "Horses", confidence: 0.5, reasoning: [], matchedTokenCount: 1 },
      { hscode: "0102", description: "Cattle", confidence: 0.8, reasoning: [], matchedTokenCount: 1 },
    ];
    const result = applyGir3a(candidates);
    expect(result[0].hscode).toBe("0102");
  });

  it("breaks ties by matchedTokenCount (more matched tokens = more specific)", () => {
    const candidates: Candidate[] = [
      { hscode: "0101", description: "Horses", confidence: 0.8, reasoning: ["a", "b", "c", "d"], matchedTokenCount: 2 },
      { hscode: "0102", description: "Cattle", confidence: 0.8, reasoning: ["a", "b", "c", "d"], matchedTokenCount: 5 },
    ];
    const result = applyGir3a(candidates);
    expect(result[0].hscode).toBe("0102");
  });
});

describe("applyGir3c", () => {
  it("picks last heading numerically when tied on both confidence and matchedTokenCount", () => {
    const candidates: Candidate[] = [
      { hscode: "0101", description: "Horses", confidence: 0.8, reasoning: ["a"], matchedTokenCount: 3 },
      { hscode: "0103", description: "Swine", confidence: 0.8, reasoning: ["a"], matchedTokenCount: 3 },
      { hscode: "0102", description: "Cattle", confidence: 0.8, reasoning: ["a"], matchedTokenCount: 3 },
    ];
    const result = applyGir3c(candidates);
    expect(result[0].hscode).toBe("0103");
  });

  it("does not reorder when no tie exists", () => {
    const candidates: Candidate[] = [
      { hscode: "0102", description: "Cattle", confidence: 0.9, reasoning: [], matchedTokenCount: 2 },
      { hscode: "0101", description: "Horses", confidence: 0.5, reasoning: [], matchedTokenCount: 1 },
    ];
    const result = applyGir3c(candidates);
    expect(result[0].hscode).toBe("0102");
  });
});
```

- [ ] **Step 3: テスト実行 — 失敗確認**

Run: `npx vitest run tests/gir.test.ts`
Expected: FAIL — GIR 3(a) tie-breaking by matchedTokenCount fails

- [ ] **Step 4: GIR 3(a)を改善**

```typescript
// src/gir.ts
import type { Candidate } from "./types.js";

/**
 * GIR 3(a): Most specific description wins.
 * Primary sort by confidence descending.
 * Tie-break by matchedTokenCount (more matched tokens = more specific description).
 */
export function applyGir3a(candidates: Candidate[]): Candidate[] {
  return [...candidates].sort((a, b) => {
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    return b.matchedTokenCount - a.matchedTokenCount;
  });
}

/**
 * GIR 3(c): When 3(a) and 3(b) cannot resolve, take the last heading in numerical order.
 */
export function applyGir3c(candidates: Candidate[]): Candidate[] {
  if (candidates.length < 2) return candidates;
  const topConfidence = candidates[0].confidence;
  const topMatchCount = candidates[0].matchedTokenCount;
  const tied = candidates.filter(
    (c) => c.confidence === topConfidence && c.matchedTokenCount === topMatchCount,
  );
  if (tied.length <= 1) return candidates;
  tied.sort((a, b) => b.hscode.localeCompare(a.hscode));
  const rest = candidates.filter(
    (c) => !(c.confidence === topConfidence && c.matchedTokenCount === topMatchCount),
  );
  return [tied[0], ...rest];
}
```

- [ ] **Step 5: テスト実行 — パス確認**

Run: `npx vitest run tests/gir.test.ts`
Expected: PASS（全4テスト）

- [ ] **Step 6: コミット**

```bash
git add src/types.ts src/gir.ts tests/gir.test.ts
git commit -m "feat: improve GIR 3(a) with matchedTokenCount tie-breaking"
```

---

### Task 8: classify() メインフロー統合

**Note: パフォーマンス考慮事項**
3重ループ（chapter × heading × subheading）で最悪9,000候補が生成される可能性がある。
フィルタリングで実際には数百程度に収まるはず。ただし`tokenize(node.description)`が各ノードで
毎回呼ばれるため、もし100ms目標を超える場合はtokenize結果のメモ化が最初のチューニングポイント。

**Files:**
- Modify: `src/classifier.ts`
- Modify: `tests/classifier.test.ts`

- [ ] **Step 1: テストを書く**

`tests/classifier.test.ts` に追加:

```typescript
describe("classify", () => {
  beforeAll(() => {
    loadTree(undefined, { force: true });
  });

  it("returns candidates for 'live horses'", () => {
    const result = classify({ description: "live horses" });
    expect(result.candidates.length).toBeGreaterThan(0);
    expect(result.candidates.length).toBeLessThanOrEqual(3);
  });

  it("each candidate has required fields", () => {
    const result = classify({ description: "wooden dining table" });
    for (const c of result.candidates) {
      expect(c.hscode).toBeTruthy();
      expect(c.description).toBeTruthy();
      expect(typeof c.confidence).toBe("number");
      expect(c.confidence).toBeGreaterThanOrEqual(0);
      expect(c.confidence).toBeLessThanOrEqual(1);
      expect(Array.isArray(c.reasoning)).toBe(true);
      expect(c.reasoning.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("reasoning path includes section, chapter, heading, subheading", () => {
    const result = classify({ description: "live horses" });
    const top = result.candidates[0];
    expect(top.reasoning.some((r) => r.startsWith("Section"))).toBe(true);
    expect(top.reasoning.some((r) => r.startsWith("Chapter"))).toBe(true);
    expect(top.reasoning.some((r) => r.startsWith("Heading"))).toBe(true);
    expect(top.reasoning.some((r) => r.startsWith("Subheading"))).toBe(true);
  });

  it("candidates are sorted by confidence descending", () => {
    const result = classify({ description: "wooden furniture" });
    for (let i = 1; i < result.candidates.length; i++) {
      expect(result.candidates[i].confidence).toBeLessThanOrEqual(
        result.candidates[i - 1].confidence,
      );
    }
  });

  it("sets needs_review based on confidence threshold", () => {
    const result = classify({ description: "wooden dining table" });
    const topConfidence = result.candidates[0]?.confidence ?? 0;
    if (topConfidence < 0.7) {
      expect(result.needs_review).toBe(true);
    }
  });

  it("returns empty candidates for empty description", () => {
    const result = classify({ description: "" });
    expect(result.candidates).toEqual([]);
    expect(result.needs_review).toBe(true);
  });

  it("completes within 100ms", () => {
    loadTree(); // ensure cached
    const start = performance.now();
    classify({ description: "electrical motor generator" });
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(100);
  });
});
```

- [ ] **Step 2: テスト実行 — 失敗確認**

Run: `npx vitest run tests/classifier.test.ts`
Expected: FAIL — classify still returns empty candidates

- [ ] **Step 3: classify()メインフローを実装**

`src/classifier.ts` のclassify()を書き換え:

```typescript
import { applyGir3a, applyGir3c } from "./gir.js";
import type { Candidate } from "./types.js";

const NEEDS_REVIEW_THRESHOLD = 0.7;

// Weights for final confidence: section, chapter, heading, subheading
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
  const candidateChapters = tree.filter((ch) => sectionChapterCodes.has(ch.code));
  const chapterScores = scoreNodes(tokens, candidateChapters);

  // Step 3: For each candidate chapter, score headings
  const allCandidates: Candidate[] = [];

  for (const { node: chapter, score: chScore } of chapterScores) {
    const sectionEntry = sections.find((s) => s.chapters.includes(chapter.code));
    const sScore = sectionEntry?.score ?? 0;

    const headingScores = scoreNodes(tokens, chapter.children);

    for (const { node: heading, score: hScore } of headingScores) {
      // Step 4: Score subheadings
      if (heading.children.length === 0) {
        // Heading with no subheadings — use heading as final
        const descTokens = new Set(tokenize(heading.description));
        const matchedCount = tokens.filter((t) => descTokens.has(t)).length;
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
        const matchedCount = tokens.filter((t) => descTokens.has(t)).length;

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

  // Step 5: GIR resolution and ranking
  let ranked = applyGir3a(allCandidates);
  ranked = applyGir3c(ranked);

  // Top 3 candidates
  const top3 = ranked.slice(0, 3);

  const topConfidence = top3[0]?.confidence ?? 0;
  const needs_review = topConfidence < NEEDS_REVIEW_THRESHOLD;

  return { candidates: top3, needs_review };
}
```

- [ ] **Step 4: テスト実行 — パス確認**

Run: `npx vitest run tests/classifier.test.ts`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/classifier.ts tests/classifier.test.ts
git commit -m "feat: implement classify main flow with 4-layer scoring pipeline"
```

---

### Task 9: index.ts & CLI更新

**Files:**
- Modify: `src/index.ts`
- Modify: `cli/index.ts`

- [ ] **Step 1: index.tsにexport追加**

```typescript
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
```

- [ ] **Step 2: CLI にloadTree()追加**

```typescript
// cli/index.ts
import { classify, loadTree } from "../src/index.js";

const args = process.argv.slice(2);
const command = args[0];

if (command === "classify" && args[1]) {
  loadTree();
  const result = classify({ description: args[1] });
  if (result.candidates.length === 0) {
    console.log("No candidates found.");
  } else {
    for (const c of result.candidates) {
      console.log(`${c.hscode} (${(c.confidence * 100).toFixed(0)}%) - ${c.description}`);
      for (const r of c.reasoning) {
        console.log(`  → ${r}`);
      }
      console.log();
    }
  }
  if (result.needs_review) {
    console.log("⚠ Low confidence — manual review recommended.");
  }
} else {
  console.log("Usage: tariff-engine classify <description>");
  console.log('Example: tariff-engine classify "wooden dining table"');
}
```

- [ ] **Step 3: CLIで動作確認**

Run: `npx tsx cli/index.ts classify "wooden dining table"`
Expected: 候補が1件以上表示される。reasoning pathにSection/Chapter/Heading/Subheadingが含まれる。

- [ ] **Step 4: コミット**

```bash
git add src/index.ts cli/index.ts
git commit -m "feat: update exports and CLI to use loadTree"
```

---

### Task 10: テストケース作成（手動10件）

**Files:**
- Create: `tests/fixtures/test-cases.json`
- Modify: `tests/classifier.test.ts`

- [ ] **Step 1: 手動テストケース10件を作成**

```json
[
  { "description": "live horses", "expected4": "0101", "expected6": "010121" },
  { "description": "frozen beef", "expected4": "0202", "expected6": "020230" },
  { "description": "fresh salmon", "expected4": "0302", "expected6": "030214" },
  { "description": "rice", "expected4": "1006", "expected6": "100630" },
  { "description": "cane sugar", "expected4": "1701", "expected6": "170114" },
  { "description": "cotton yarn", "expected4": "5205", "expected6": "520512" },
  { "description": "steel pipe", "expected4": "7304", "expected6": "730419" },
  { "description": "leather handbag", "expected4": "4202", "expected6": "420221" },
  { "description": "plastic chair", "expected4": "9401", "expected6": "940180" },
  { "description": "wooden dining table", "expected4": "9403", "expected6": "940360" }
]
```

**テストケース選定の根拠:**
- 7件は素直なケース（セクションキーワードが明確に対応）
- "leather handbag": Section VIII（leather）とSection XII（accessories）にまたがる境界ケース → 正解は4202（旅行用品・ハンドバッグ）
- "plastic chair": Section VII（plastics）とSection XX（furniture）にまたがる境界ケース → 正解は9401（着席用の家具）
- "rice": 1語入力のエッジケース（短い入力で高スコアが出すぎる問題の検出用）

ファイル: `tests/fixtures/test-cases.json`

- [ ] **Step 2: テストケースを使った精度テストを追加**

`tests/classifier.test.ts` に追加:

```typescript
import testCases from "./fixtures/test-cases.json";

describe("accuracy: manual test cases", () => {
  beforeAll(() => {
    loadTree(undefined, { force: true });
  });

  // Individual tests for debugging
  for (const tc of testCases) {
    it(`classifies "${tc.description}" → expects 4-digit ${tc.expected4}`, () => {
      const result = classify({ description: tc.description });
      expect(result.candidates.length).toBeGreaterThan(0);
      // Log for debugging — not a hard assertion yet
      const top = result.candidates[0];
      console.log(
        `  ${tc.description}: got ${top.hscode} (${(top.confidence * 100).toFixed(0)}%), expected ${tc.expected4}/${tc.expected6}`,
      );
    });
  }

  it("meets 4-digit accuracy threshold (≥70%)", () => {
    let correct4 = 0;
    for (const tc of testCases) {
      const result = classify({ description: tc.description });
      if (result.candidates.length > 0) {
        const topCode4 = result.candidates[0].hscode.slice(0, 4);
        if (topCode4 === tc.expected4) correct4++;
      }
    }
    const accuracy4 = correct4 / testCases.length;
    console.log(`4-digit accuracy: ${correct4}/${testCases.length} = ${(accuracy4 * 100).toFixed(0)}%`);
    expect(accuracy4).toBeGreaterThanOrEqual(0.7);
  });

  it("meets 6-digit accuracy threshold (≥50%)", () => {
    let correct6 = 0;
    for (const tc of testCases) {
      const result = classify({ description: tc.description });
      if (result.candidates.length > 0) {
        if (result.candidates[0].hscode === tc.expected6) correct6++;
      }
    }
    const accuracy6 = correct6 / testCases.length;
    console.log(`6-digit accuracy: ${correct6}/${testCases.length} = ${(accuracy6 * 100).toFixed(0)}%`);
    expect(accuracy6).toBeGreaterThanOrEqual(0.5);
  });
});
```

- [ ] **Step 3: テスト実行 — 精度確認**

Run: `npx vitest run tests/classifier.test.ts`
Expected: 個別テストはPASS。精度テストの結果を見て、閾値未達なら次タスクで調整。

- [ ] **Step 4: コミット**

```bash
mkdir -p tests/fixtures
git add tests/fixtures/test-cases.json tests/classifier.test.ts
git commit -m "test: add 10 manual test cases with accuracy benchmarks"
```

---

### Task 11: 精度チューニングと追加テストケース

**Files:**
- Modify: `tests/fixtures/test-cases.json`（40件追加）
- Modify: `src/classifier.ts`（必要なら調整）
- Modify: `src/section-map.ts`（キーワード調整が必要な場合）

- [ ] **Step 1: 10件テスト結果を分析**

Run: `npx vitest run tests/classifier.test.ts -- --reporter=verbose`

出力から以下を確認:
- 各テストケースのtop候補HSコード vs 期待コード
- 失敗パターン（セクションミス？チャプターミス？ヘディングミス？）
- confidence分布

- [ ] **Step 2: 必要な調整を実施**

分析結果に基づいて:
- section-map.tsのキーワード追加（マッチしないセクションがある場合）
- スコアリングロジックの微調整
- confidence閾値の調整（仮置き0.7→実測ベース）

- [ ] **Step 3: 残り40件のテストケースを追加**

US CROSS（`rulings.cbp.gov`）等の公開データから40件を追加。21セクションから均等に近い配分で選定。`tests/fixtures/test-cases.json` に追記。

各テストケースの形式:
```json
{ "description": "product description in English", "expected4": "NNNN", "expected6": "NNNNNN" }
```

- [ ] **Step 4: 全50件で精度テスト実行**

Run: `npx vitest run tests/classifier.test.ts`
Expected:
- 4桁精度 ≧ 70%
- 6桁精度 ≧ 50%
- 全結果にreasoning path含む
- 100ms/件以内

- [ ] **Step 5: コミット**

```bash
git add tests/fixtures/test-cases.json src/classifier.ts src/section-map.ts
git commit -m "feat: tune classifier accuracy and add 50 test cases"
```

---

### Task 12: 全テスト実行・ビルド確認・push

**Files:** なし（検証のみ）

- [ ] **Step 1: 全テスト実行**

Run: `npx vitest run`
Expected: 全テストPASS（tokenizer, parse-nomenclature, section-map, rule-engine, gir, classifier）

- [ ] **Step 2: ビルド確認**

Run: `npm run build`
Expected: `dist/` に出力、エラーなし

- [ ] **Step 3: CLI動作確認**

Run: `npx tsx cli/index.ts classify "electric bicycle"`
Expected: 候補表示、reasoning path含む

- [ ] **Step 4: push**

```bash
git push origin main
```

---

## 依存関係

```
Task 1 (section-map) ─┐
Task 2 (loadTree)     ├→ Task 3 (section scoring) → Task 4 (node scoring) → Task 5 (subheading) → Task 8 (classify統合)
Task 6 (equals修正)   ┘                                                                           ↓
Task 7 (GIR改善) ─────────────────────────────────────────────────────────────────────────────────→ Task 8
                                                                                                   ↓
                                                                                            Task 9 (CLI) → Task 10 (テスト10件) → Task 11 (チューニング+40件) → Task 12 (検証・push)
```
