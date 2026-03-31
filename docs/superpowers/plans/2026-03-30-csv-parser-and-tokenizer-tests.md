# CSVパーサー + トークナイザーテスト 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** UN Comtrade CSVをパースしてhs-tree.jsonを生成し、トークナイザーの挙動をテストで固定する

**Architecture:** CSVパーサーはNode.js stdlibのみで実装（readline不要、fs.readFileSync + split）。CSVは6941行・シンプルな構造なので外部ライブラリ不要。HsNodeにsectionフィールドを追加してセクション情報を保持。トークナイザーテストはレビュー指摘のハイフン挙動等を固定。

**Tech Stack:** TypeScript, Node.js fs, vitest

---

## ファイル構成

```
src/types.ts                    # HsNode に section フィールド追加
compiler/parse-nomenclature.ts  # CSV → hs-tree.json パーサー実装
tests/parse-nomenclature.test.ts # パーサーテスト
tests/tokenizer.test.ts         # トークナイザーテスト
```

---

### Task 1: HsNode 型に section フィールド追加

**Files:**
- Modify: `src/types.ts:25-31`
- Modify: `tests/types.test.ts`

- [ ] **Step 1: types.ts の HsNode に section を追加**

```typescript
export interface HsNode {
  code: string;
  description: string;
  level: number;
  section?: string;
  parent?: string;
  children: HsNode[];
}
```

- [ ] **Step 2: tests/types.test.ts に HsNode テスト追加**

`tests/types.test.ts` の describe ブロック内に追加:

```typescript
  it("HsNode supports section field", () => {
    const node: HsNode = {
      code: "01",
      description: "Animals; live",
      level: 2,
      section: "I",
      parent: undefined,
      children: [],
    };
    expect(node.section).toBe("I");
    expect(node.children).toHaveLength(0);
  });
```

- [ ] **Step 3: テスト実行**

```bash
npx vitest run tests/types.test.ts
```

Expected: 4 tests pass

- [ ] **Step 4: ビルド確認**

```bash
npm run build
```

Expected: ビルド成功

- [ ] **Step 5: コミット**

```bash
git add src/types.ts tests/types.test.ts
git commit -m "feat: add section field to HsNode type"
```

---

### Task 2: トークナイザーテスト追加

**Files:**
- Create: `tests/tokenizer.test.ts`

- [ ] **Step 1: tests/tokenizer.test.ts を作成**

```typescript
import { describe, it, expect } from "vitest";
import { tokenize } from "../src/tokenizer.js";

describe("tokenize", () => {
  it("lowercases and splits basic description", () => {
    expect(tokenize("Wooden Chair")).toEqual(["wooden", "chair"]);
  });

  it("removes stop words", () => {
    expect(tokenize("the table of wood")).toEqual(["table", "wood"]);
  });

  it("removes punctuation except hyphens", () => {
    expect(tokenize("motor cars, trucks & buses")).toEqual([
      "motor",
      "cars",
      "trucks",
      "buses",
    ]);
  });

  it("preserves hyphenated compound words as single token", () => {
    expect(tokenize("high-quality steel")).toEqual(["high-quality", "steel"]);
  });

  it("filters single-character tokens", () => {
    expect(tokenize("a b c wood")).toEqual(["wood"]);
  });

  it("handles semicolons in HS descriptions", () => {
    expect(tokenize("Horses; live, pure-bred breeding animals")).toEqual([
      "horses",
      "live",
      "pure-bred",
      "breeding",
      "animals",
    ]);
  });

  it("handles empty string", () => {
    expect(tokenize("")).toEqual([]);
  });

  it("handles numeric content", () => {
    expect(tokenize("weighing less than 50kg")).toEqual([
      "weighing",
      "less",
      "than",
      "50kg",
    ]);
  });
});
```

- [ ] **Step 2: テスト実行**

```bash
npx vitest run tests/tokenizer.test.ts
```

Expected: 8 tests pass（トークナイザーは既に実装済み）

- [ ] **Step 3: コミット**

```bash
git add tests/tokenizer.test.ts
git commit -m "test: add tokenizer tests covering hyphens, punctuation, and HS descriptions"
```

---

### Task 3: CSVパーサー実装

**Files:**
- Modify: `compiler/parse-nomenclature.ts`
- Create: `tests/parse-nomenclature.test.ts`

- [ ] **Step 1: テスト作成 tests/parse-nomenclature.test.ts**

```typescript
import { describe, it, expect } from "vitest";
import { parseCsvContent, buildTree } from "../compiler/parse-nomenclature.js";
import type { HsNode } from "../src/types.js";

const SAMPLE_CSV = `section,hscode,description,parent,level
I,01,Animals; live,TOTAL,2
I,0101,"Horses, asses, mules and hinnies; live",01,4
I,010121,"Horses; live, pure-bred breeding animals",0101,6
I,010129,"Horses; live, other than pure-bred breeding animals",0101,6`;

describe("parseCsvContent", () => {
  it("parses CSV rows into flat HsNode array", () => {
    const nodes = parseCsvContent(SAMPLE_CSV);
    expect(nodes).toHaveLength(4);
    expect(nodes[0]).toEqual({
      code: "01",
      description: "Animals; live",
      level: 2,
      section: "I",
      parent: undefined,
      children: [],
    });
  });

  it("handles quoted descriptions with commas", () => {
    const nodes = parseCsvContent(SAMPLE_CSV);
    expect(nodes[1].description).toBe(
      "Horses, asses, mules and hinnies; live",
    );
  });

  it("sets parent to undefined for chapters (parent=TOTAL)", () => {
    const nodes = parseCsvContent(SAMPLE_CSV);
    expect(nodes[0].parent).toBeUndefined();
  });

  it("sets parent code for headings and subheadings", () => {
    const nodes = parseCsvContent(SAMPLE_CSV);
    expect(nodes[1].parent).toBe("01");
    expect(nodes[2].parent).toBe("0101");
  });

  it("excludes TOTAL rows", () => {
    const csvWithTotal = `section,hscode,description,parent,level
I,01,Animals; live,TOTAL,2
TOTAL,TOTAL,Total of all HS2022 commodities,TOTAL,5`;
    const nodes = parseCsvContent(csvWithTotal);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].code).toBe("01");
  });
});

describe("buildTree", () => {
  it("builds hierarchical tree from flat nodes", () => {
    const nodes = parseCsvContent(SAMPLE_CSV);
    const tree = buildTree(nodes);
    expect(tree).toHaveLength(1); // 1 chapter
    expect(tree[0].code).toBe("01");
    expect(tree[0].children).toHaveLength(1); // 1 heading
    expect(tree[0].children[0].code).toBe("0101");
    expect(tree[0].children[0].children).toHaveLength(2); // 2 subheadings
  });

  it("preserves section info in tree nodes", () => {
    const nodes = parseCsvContent(SAMPLE_CSV);
    const tree = buildTree(nodes);
    expect(tree[0].section).toBe("I");
    expect(tree[0].children[0].section).toBe("I");
  });
});
```

- [ ] **Step 2: テスト実行して失敗確認**

```bash
npx vitest run tests/parse-nomenclature.test.ts
```

Expected: FAIL（parseCsvContent, buildTree が未実装）

- [ ] **Step 3: compiler/parse-nomenclature.ts を実装**

```typescript
// compiler/parse-nomenclature.ts

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { HsNode } from "../src/types.js";

/**
 * Parse a CSV line handling quoted fields with commas.
 */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      fields.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  fields.push(current.trim());
  return fields;
}

/**
 * Parse CSV content string into a flat array of HsNode.
 * Skips header row and TOTAL/summary rows.
 */
export function parseCsvContent(csv: string): HsNode[] {
  const lines = csv.split("\n").filter((line) => line.trim() !== "");
  const nodes: HsNode[] = [];

  // Skip header
  for (let i = 1; i < lines.length; i++) {
    const fields = parseCsvLine(lines[i]);
    if (fields.length < 5) continue;

    const [section, hscode, description, parent, levelStr] = fields;

    // Skip TOTAL rows and non-standard levels
    if (section === "TOTAL" || hscode === "TOTAL") continue;
    const level = Number(levelStr);
    if (level !== 2 && level !== 4 && level !== 6) continue;

    nodes.push({
      code: hscode,
      description,
      level,
      section,
      parent: parent === "TOTAL" ? undefined : parent,
      children: [],
    });
  }

  return nodes;
}

/**
 * Build a hierarchical tree from a flat array of HsNode.
 * Chapters (level 2) are roots. Headings (4) are children of chapters.
 * Subheadings (6) are children of headings.
 */
export function buildTree(nodes: HsNode[]): HsNode[] {
  const nodeMap = new Map<string, HsNode>();
  for (const node of nodes) {
    nodeMap.set(node.code, { ...node, children: [] });
  }

  const roots: HsNode[] = [];

  for (const node of nodeMap.values()) {
    if (node.parent && nodeMap.has(node.parent)) {
      nodeMap.get(node.parent)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

// CLI entry point: run when executed directly
const isMain =
  process.argv[1] &&
  (process.argv[1].endsWith("parse-nomenclature.ts") ||
    process.argv[1].endsWith("parse-nomenclature.js"));

if (isMain) {
  const csvPath = "data/raw/data/harmonized-system.csv";
  const outputPath = "data/hs-tree.json";

  try {
    const csv = readFileSync(csvPath, "utf-8");
    const nodes = parseCsvContent(csv);
    const tree = buildTree(nodes);

    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, JSON.stringify(tree, null, 2));

    const chapters = tree.length;
    const headings = tree.reduce((sum, ch) => sum + ch.children.length, 0);
    const subheadings = tree.reduce(
      (sum, ch) =>
        sum + ch.children.reduce((s, h) => s + h.children.length, 0),
      0,
    );

    console.log(`Parsed: ${chapters} chapters, ${headings} headings, ${subheadings} subheadings`);
    console.log(`Output: ${outputPath}`);
  } catch (err) {
    if (
      err instanceof Error &&
      "code" in err &&
      (err as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      console.error(`File not found: ${csvPath}`);
      console.error(
        "Run: git clone https://github.com/datasets/harmonized-system.git data/raw",
      );
    } else {
      throw err;
    }
  }
}
```

- [ ] **Step 4: テスト実行してパス確認**

```bash
npx vitest run tests/parse-nomenclature.test.ts
```

Expected: 7 tests pass

- [ ] **Step 5: コミット**

```bash
git add compiler/parse-nomenclature.ts tests/parse-nomenclature.test.ts
git commit -m "feat: implement CSV parser for UN Comtrade HS dataset"
```

---

### Task 4: 実データで hs-tree.json 生成 + 検証

**Files:**
- Generate: `data/hs-tree.json` (gitignored)

- [ ] **Step 1: パーサー実行**

```bash
npx tsx compiler/parse-nomenclature.ts
```

Expected output:
```
Parsed: 97 chapters, 1229 headings, 5613 subheadings
Output: data/hs-tree.json
```

- [ ] **Step 2: 出力ファイル検証**

```bash
node -e "
const tree = require('./data/hs-tree.json');
console.log('Chapters:', tree.length);
console.log('First:', tree[0].code, tree[0].description);
console.log('Last:', tree[tree.length-1].code, tree[tree.length-1].description);
console.log('Ch01 headings:', tree[0].children.length);
console.log('H0101 subheadings:', tree[0].children[0]?.children.length);
"
```

Expected: 97 chapters, Chapter 01 = "Animals; live", correct child counts

- [ ] **Step 3: .gitignore に data/raw/ 追加**

`.gitignore` に以下を追加（クローンした生データは追跡しない）:

```
data/raw/
```

- [ ] **Step 4: コミット**

```bash
git add .gitignore
git commit -m "chore: gitignore raw CSV data directory"
```

---

### Task 5: 全テスト実行 + Push

- [ ] **Step 1: 全テスト実行**

```bash
npm test
```

Expected: types(4) + tokenizer(8) + parse-nomenclature(7) = 19 tests pass

- [ ] **Step 2: ビルド確認**

```bash
npm run build
```

Expected: ビルド成功

- [ ] **Step 3: Push**

```bash
git push origin main
```
