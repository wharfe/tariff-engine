# AIコンパイラ横展開 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** AIコンパイラパイプラインをSection XVI, VII, XX, XIの主要20章に横展開し、越境ECカバレッジを大幅に向上させる

**Architecture:** 既存の3レイヤーパイプライン（Notes Parser → Clause Classifier → Rule Generator）をそのまま活用。few-shotを汎用化し、compile-rules.tsのデフォルト引数を調整。各Section/Chapterのnotesを手動でmarkdown構造化し、パイプラインを実行して検証。

**Tech Stack:** TypeScript, Anthropic Claude Haiku (build-time), vitest

---

## ファイル構成

### 新規作成
- `compiler/few-shot/generic.json` — 汎用few-shot (5タイプ×2件)
- `data/notes/section-16.md` — Section XVI Notes
- `data/notes/chapter-84.md` — Chapter 84 Notes
- `data/notes/chapter-85.md` — Chapter 85 Notes
- `data/notes/section-07.md` — Section VII Notes
- `data/notes/chapter-39.md` — Chapter 39 Notes
- `data/notes/chapter-40.md` — Chapter 40 Notes
- `data/notes/section-20.md` — Section XX Notes
- `data/notes/chapter-94.md` — Chapter 94 Notes
- `data/notes/chapter-95.md` — Chapter 95 Notes
- `data/notes/chapter-96.md` — Chapter 96 Notes
- `data/notes/chapter-61.md` — Chapter 61 Notes
- `data/notes/chapter-62.md` — Chapter 62 Notes
- `data/rules/chapter-84.json` ... `chapter-96.json` — コンパイル済みルール
- `tests/fixtures/chapter-84-cases.json` ... `chapter-96-cases.json` — テストケース
- `tests/chapter-84.test.ts` ... `tests/chapter-96.test.ts` — 精度テスト

### 変更
- `compiler/compile-rules.ts:64` — few-shotパスのデフォルト化
- `compiler/clause-classifier.ts:20-23` — few-shotパス引数をオプショナルに

---

### Task 1: compile-rules.tsのfew-shotデフォルト化

**Files:**
- Modify: `compiler/compile-rules.ts:64`
- Modify: `compiler/clause-classifier.ts:20-23`

- [ ] **Step 1: compile-rules.tsでfew-shotパスにフォールバックロジックを追加**

`compiler/compile-rules.ts` のmain()関数で、few-shot解決ロジックを変更する:

```typescript
// Step 2: Classify via LLM
// Resolve few-shot: chapter-specific > generic
const chapterFewShot = resolve(`compiler/few-shot/chapter-${args.chapter}.json`);
const genericFewShot = resolve("compiler/few-shot/generic.json");
const fewShotPath = existsSync(chapterFewShot) ? chapterFewShot : genericFewShot;
console.log(`Using few-shot: ${fewShotPath}`);
console.log("Classifying clauses using LLM...");
const classified = await classifyClauses(clauses, fewShotPath);
```

`existsSync` を `node:fs` のimportに追加:
```typescript
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
```

- [ ] **Step 2: ビルドが通ることを確認**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 3: コミット**

```bash
git add compiler/compile-rules.ts
git commit -m "feat: add generic few-shot fallback in compile-rules CLI"
```

---

### Task 2: 汎用few-shot (generic.json) を初期作成

**Files:**
- Create: `compiler/few-shot/generic.json`

Chapter 87のfew-shotから初期バージョンを作成。後のタスクでSection XVI/VII/XXの例に差し替えていく。

- [ ] **Step 1: generic.jsonを作成**

Chapter 87のfew-shot 12件から、5タイプ×2件を選定して汎用few-shotを作成。この時点ではChapter 87の例文のみだが、各Sectionの処理後にインクリメンタルに更新する。

```json
[
  {
    "input": "This Section does not cover articles of heading 9503 or 9508, or bobsleighs, toboggans or the like of heading 9506.",
    "output": {
      "clauseType": "exclusion",
      "params": {
        "excludedCodes": ["9503", "9508", "9506"],
        "reason": "Section XVII Note 1: articles of headings 9503, 9508, 9506 are excluded from this Section"
      }
    }
  },
  {
    "input": "This Chapter does not cover railway or tramway rolling-stock designed solely for running on rails.",
    "output": {
      "clauseType": "exclusion",
      "params": {
        "excludedCodes": ["87"],
        "reason": "Chapter 87 Note 1: railway/tramway rolling-stock for rails only is excluded"
      }
    }
  },
  {
    "input": "For the purposes of this Chapter, \"tractors\" means vehicles constructed essentially for hauling or pushing another vehicle, appliance or load, whether or not they contain subsidiary provision for the transport, in connection with the main use of the tractor, of tools, seeds, fertilisers or other goods.",
    "output": {
      "clauseType": "definition",
      "params": {
        "term": "tractors",
        "meaning": "vehicles constructed essentially for hauling or pushing another vehicle, appliance or load",
        "appliesTo": ["8701"]
      }
    }
  },
  {
    "input": "Heading 87.12 includes all children's bicycles. Other children's wheeled toys are classified in heading 95.03.",
    "output": {
      "clauseType": "definition",
      "params": {
        "term": "children's bicycles",
        "meaning": "all children's bicycles fall under heading 87.12; other wheeled toys go to 95.03",
        "appliesTo": ["8712"]
      }
    }
  },
  {
    "input": "vehicles specially constructed to travel on both road and rail are classified in the appropriate heading of Chapter 87;",
    "output": {
      "clauseType": "routing",
      "params": {
        "target": "87",
        "conditions": [
          { "type": "contains", "field": "description", "value": "road" },
          { "type": "contains", "field": "description", "value": "rail" }
        ]
      }
    }
  },
  {
    "input": "Motor chassis fitted with cabs fall in headings 87.02 to 87.04, and not in heading 87.06.",
    "output": {
      "clauseType": "routing",
      "params": {
        "target": "8702-8704",
        "conditions": [
          { "type": "contains", "field": "description", "value": "chassis" },
          { "type": "contains", "field": "description", "value": "cab" }
        ]
      }
    }
  },
  {
    "input": "References in Chapters 86 to 88 to \"parts\" or \"accessories\" do not apply to parts or accessories which are not suitable for use solely or principally with the articles of those Chapters. A part or accessory which answers to a description in two or more of the headings of those Chapters is to be classified in the heading appropriate to the principal use of that part or accessory.",
    "output": {
      "clauseType": "parts_rule",
      "params": {
        "rule": "principal_use",
        "affectedCodes": ["86", "87", "88"]
      }
    }
  },
  {
    "input": "Machines and working tools designed for fitting to tractors of heading 87.01 as their sole or principal source of power remain classified in their respective headings even when presented with the tractor, and whether or not mounted on it.",
    "output": {
      "clauseType": "parts_rule",
      "params": {
        "rule": "stay_in_own_heading",
        "affectedCodes": ["8701"]
      }
    }
  },
  {
    "input": "Subheading 8708.22 covers front windscreens (windshields), rear windows and other windows, framed, for use with vehicles of headings 87.01 to 87.05.",
    "output": {
      "clauseType": "scope",
      "params": {
        "heading": "870822",
        "covers": "front windscreens, rear windows and other windows, framed",
        "conditions": [
          { "type": "contains", "field": "description", "value": "windscreen" }
        ]
      }
    }
  },
  {
    "input": "amphibious motor vehicles are classified in the appropriate heading of Chapter 87;",
    "output": {
      "clauseType": "scope",
      "params": {
        "heading": "87",
        "covers": "amphibious motor vehicles",
        "conditions": [
          { "type": "contains", "field": "description", "value": "amphibious" }
        ]
      }
    }
  }
]
```

- [ ] **Step 2: コミット**

```bash
git add compiler/few-shot/generic.json
git commit -m "feat: add generic few-shot for cross-chapter compilation"
```

---

### Task 3: Section XVI — Notes構造化 (Chapter 84, 85)

**Files:**
- Create: `data/notes/section-16.md`
- Create: `data/notes/chapter-84.md`
- Create: `data/notes/chapter-85.md`

Section XVI (Machinery and Mechanical Appliances; Electrical Equipment) のNotesをWCOテキストから手動構造化する。

- [ ] **Step 1: WCO公開テキストからSection XVI Notesを取得・構造化**

WCOのHS Nomenclature公開テキスト（customs.go.jp等）からSection XVI Notesを取得。以下のフォーマットで `data/notes/section-16.md` に保存:

```markdown
## Section XVI Notes

1. This Section does not cover:
  (a) ...
  (b) ...
  ...

2. Subject to Note 1 to this Section, ...
...
```

ポイント:
- HS 2022 Nomenclature準拠
- 既存の `section-17.md` と同じmarkdownフォーマットに合わせる
- 番号付きnote `N. text` + sub-item `(a) text` の構造

- [ ] **Step 2: Chapter 84 Notesを構造化**

`data/notes/chapter-84.md` に以下のフォーマットで保存:

```markdown
## Chapter 84 Notes

1. ...
2. ...

## Subheading Notes

1. ...
```

- [ ] **Step 3: Chapter 85 Notesを構造化**

`data/notes/chapter-85.md` に同じフォーマットで保存。

- [ ] **Step 4: notes-parserでパース確認**

```bash
npx tsx -e "
import { parseNotes } from './compiler/notes-parser.js';
import { readFileSync } from 'fs';
const sec = readFileSync('data/notes/section-16.md', 'utf-8');
const ch84 = readFileSync('data/notes/chapter-84.md', 'utf-8');
const clauses = parseNotes(sec + '\n\n' + ch84);
console.log('Parsed clauses:', clauses.length);
clauses.forEach(c => console.log(\`  [\${c.source}] Note \${c.noteNumber}\${c.subItem ?? ''}: \${c.text.slice(0,60)}...\`));
"
```

Expected: 各noteが正しくパースされ、source/noteNumber/subItemが正確

- [ ] **Step 5: コミット**

```bash
git add data/notes/section-16.md data/notes/chapter-84.md data/notes/chapter-85.md
git commit -m "feat: add Section XVI, Chapter 84/85 notes for compiler"
```

---

### Task 4: Section XVI — ルールコンパイル (Chapter 84)

**Files:**
- Create: `data/rules/chapter-84.json` (自動生成)

- [ ] **Step 1: Chapter 84のルールをコンパイル**

```bash
npx tsx compiler/compile-rules.ts --chapter 84 \
  --notes data/notes/chapter-84.md \
  --section-notes data/notes/section-16.md
```

Expected: `data/rules/chapter-84.json` が生成される

- [ ] **Step 2: 出力JSONを目視確認**

```bash
cat data/rules/chapter-84.json | head -80
```

確認ポイント:
- `clauseType` が5タイプのいずれか
- `excludedCodes` が実在するHSコード
- `reason` が英語で意味が通る
- 明らかな誤分類（例: definitionがexclusionとして分類）がないか

- [ ] **Step 3: 問題があればfew-shotを調整して再コンパイル**

出力に問題がある場合:
1. `generic.json` にSection XVIの好例を追加/差し替え
2. 再度 `compile-rules.ts` を実行
3. 目視確認を繰り返す

- [ ] **Step 4: コミット**

```bash
git add data/rules/chapter-84.json
git commit -m "feat: compile Chapter 84 rules via AI pipeline"
```

---

### Task 5: Section XVI — ルールコンパイル (Chapter 85)

**Files:**
- Create: `data/rules/chapter-85.json` (自動生成)

- [ ] **Step 1: Chapter 85のルールをコンパイル**

```bash
npx tsx compiler/compile-rules.ts --chapter 85 \
  --notes data/notes/chapter-85.md \
  --section-notes data/notes/section-16.md
```

- [ ] **Step 2: 出力JSONを目視確認（Task 4 Step 2と同じ確認ポイント）**

- [ ] **Step 3: 問題があればfew-shotを調整して再コンパイル**

- [ ] **Step 4: コミット**

```bash
git add data/rules/chapter-85.json
git commit -m "feat: compile Chapter 85 rules via AI pipeline"
```

---

### Task 6: Section XVI — テストケース追加 (Chapter 84, 85)

**Files:**
- Create: `tests/fixtures/chapter-84-cases.json`
- Create: `tests/fixtures/chapter-85-cases.json`
- Create: `tests/chapter-84.test.ts`
- Create: `tests/chapter-85.test.ts`

- [ ] **Step 1: Chapter 84テストケースを作成**

`tests/fixtures/chapter-84-cases.json` — 越境ECで流通する機械製品を中心に10件:

```json
[
  { "description": "laptop computer, 15 inch display", "expected4": "8471", "expected6": "847130", "notes": "automatic data processing machine" },
  { "description": "air conditioner, split type, 2.5kW", "expected4": "8415", "expected6": "841510", "notes": "air conditioning machine" },
  { "description": "microwave oven, 800W", "expected4": "8516", "expected6": "851650", "notes": "note: 8516 is in Ch.85, this tests cross-chapter" },
  { "description": "washing machine, fully automatic, 7kg", "expected4": "8450", "expected6": "845011", "notes": "household laundry machine" },
  { "description": "industrial robot arm for assembly", "expected4": "8479", "expected6": "847950", "notes": "machines with individual function" },
  { "description": "ball bearing, 30mm inner diameter", "expected4": "8482", "expected6": "848210", "notes": "ball bearing" },
  { "description": "hydraulic pump for excavator", "expected4": "8413", "expected6": "841350", "notes": "liquid pump" },
  { "description": "centrifuge for laboratory use", "expected4": "8421", "expected6": "842119", "notes": "centrifuge/filtering machine" },
  { "description": "sewing machine for household use", "expected4": "8452", "expected6": "845210", "notes": "household sewing machine" },
  { "description": "diesel engine, 150kW, for industrial use", "expected4": "8408", "expected6": "840890", "notes": "compression-ignition engine" }
]
```

- [ ] **Step 2: Chapter 85テストケースを作成**

`tests/fixtures/chapter-85-cases.json` — 電気機器を中心に10件:

```json
[
  { "description": "lithium-ion battery, 3.7V 5000mAh", "expected4": "8507", "expected6": "850760", "notes": "lithium-ion accumulator" },
  { "description": "LED light bulb, E26, 10W", "expected4": "8539", "expected6": "853950", "notes": "LED lamp" },
  { "description": "electric motor, AC, 1kW", "expected4": "8501", "expected6": "850140", "notes": "AC motor" },
  { "description": "USB cable, type-C to type-C, 1m", "expected4": "8544", "expected6": "854442", "notes": "electric conductor with connector" },
  { "description": "transformer, 220V to 110V, 500W", "expected4": "8504", "expected6": "850431", "notes": "electric transformer" },
  { "description": "wireless bluetooth earphone", "expected4": "8518", "expected6": "851830", "notes": "headphone/earphone" },
  { "description": "security camera, IP, 4MP", "expected4": "8525", "expected6": "852580", "notes": "television camera" },
  { "description": "solar panel, monocrystalline, 400W", "expected4": "8541", "expected6": "854143", "notes": "photovoltaic cell" },
  { "description": "circuit breaker, 30A", "expected4": "8536", "expected6": "853620", "notes": "automatic circuit breaker" },
  { "description": "smartphone charger, 20W USB-C", "expected4": "8504", "expected6": "850440", "notes": "static converter (charger)" }
]
```

- [ ] **Step 3: Chapter 84のテストファイルを作成**

`tests/chapter-84.test.ts` — `chapter-87.test.ts` と同じパターン:

```typescript
// tests/chapter-84.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { classify, loadTree } from "../src/classifier.js";
import { loadRules, clearRules } from "../src/rule-applier.js";
import testCases from "./fixtures/chapter-84-cases.json";

interface TestCase {
  description: string;
  expected4: string;
  expected6: string;
  notes: string;
}

describe.each([
  { label: "without rules", useRules: false },
  { label: "with rules", useRules: true },
])("Chapter 84 accuracy ($label)", ({ label, useRules }) => {
  beforeAll(() => {
    loadTree();
    clearRules();
    if (useRules) {
      loadRules("84");
    }
  });

  afterAll(() => {
    clearRules();
  });

  let correct4 = 0;
  let correct6 = 0;
  const total = (testCases as TestCase[]).length;

  it.each(testCases as TestCase[])(
    "$description -> $expected4",
    ({ description, expected4 }) => {
      const result = classify({ description });
      const top = result.candidates[0];

      const match4 = top?.hscode.startsWith(expected4) ?? false;
      const match6 = top?.hscode === expected4;

      if (match4) correct4++;
      if (match6) correct6++;

      if (!match4) {
        console.log(
          `  [${label}] MISS: "${description}" -> got ${top?.hscode ?? "none"}, expected ${expected4}*`,
        );
      }

      expect(result.candidates.length).toBeGreaterThan(0);
    },
  );

  it("reports accuracy", () => {
    console.log(`\n  [${label}] 4-digit: ${correct4}/${total} (${((correct4 / total) * 100).toFixed(0)}%)`);
    console.log(`  [${label}] 6-digit: ${correct6}/${total} (${((correct6 / total) * 100).toFixed(0)}%)\n`);
  });
});
```

- [ ] **Step 4: Chapter 85のテストファイルを作成**

`tests/chapter-85.test.ts` — 上記と同じパターンで、`"84"` を `"85"` に、import元を `chapter-85-cases.json` に変更。

- [ ] **Step 5: テスト実行**

```bash
npx vitest run tests/chapter-84.test.ts tests/chapter-85.test.ts
```

Expected: テストが通り、精度レポートが表示される

- [ ] **Step 6: 全テストのリグレッションチェック**

```bash
npm test
```

Expected: 既存173テスト + 新規テストが全通過

- [ ] **Step 7: コミット**

```bash
git add tests/fixtures/chapter-84-cases.json tests/fixtures/chapter-85-cases.json \
        tests/chapter-84.test.ts tests/chapter-85.test.ts
git commit -m "test: add Chapter 84/85 accuracy tests (10 cases each)"
```

---

### Task 7: few-shot更新チェックポイント (Section XVI完了後)

**Files:**
- Modify: `compiler/few-shot/generic.json` (条件付き)

- [ ] **Step 1: Section XVI のコンパイル結果をレビュー**

Chapter 84/85のルールJSONを読み、以下を確認:
- LLMの分類精度は良好か？
- Section XVIのNotesから良いfew-shot候補はあるか？（Chapter 87と異なるドメインの例）

- [ ] **Step 2: generic.jsonを更新（良い例があれば）**

Section XVIから少なくとも1-2件をgeneric.jsonに追加し、Chapter 87ドメインの例を差し替える。5タイプ×2件=10件の制約内に収める。

更新のガイドライン:
- 各タイプの2件が異なるSectionから取られるよう調整
- LLMが正しく分類した実例を優先（汎化性の証拠）

- [ ] **Step 3: 更新した場合はコミット**

```bash
git add compiler/few-shot/generic.json
git commit -m "chore: update generic few-shot with Section XVI examples"
```

---

### Task 8: Section VII — Notes構造化 (Chapter 39, 40)

**Files:**
- Create: `data/notes/section-07.md`
- Create: `data/notes/chapter-39.md`
- Create: `data/notes/chapter-40.md`

- [ ] **Step 1: Section VII Notesを構造化**

Section VII (Plastics and Articles Thereof; Rubber and Articles Thereof)。`data/notes/section-07.md` に保存。

- [ ] **Step 2: Chapter 39 Notesを構造化**

`data/notes/chapter-39.md` に保存。

- [ ] **Step 3: Chapter 40 Notesを構造化**

`data/notes/chapter-40.md` に保存。

- [ ] **Step 4: notes-parserでパース確認**

```bash
npx tsx -e "
import { parseNotes } from './compiler/notes-parser.js';
import { readFileSync } from 'fs';
const sec = readFileSync('data/notes/section-07.md', 'utf-8');
const ch39 = readFileSync('data/notes/chapter-39.md', 'utf-8');
const clauses = parseNotes(sec + '\n\n' + ch39);
console.log('Parsed clauses:', clauses.length);
clauses.forEach(c => console.log(\`  [\${c.source}] Note \${c.noteNumber}\${c.subItem ?? ''}: \${c.text.slice(0,60)}...\`));
"
```

- [ ] **Step 5: コミット**

```bash
git add data/notes/section-07.md data/notes/chapter-39.md data/notes/chapter-40.md
git commit -m "feat: add Section VII, Chapter 39/40 notes for compiler"
```

---

### Task 9: Section VII — ルールコンパイル + テスト (Chapter 39, 40)

**Files:**
- Create: `data/rules/chapter-39.json` (自動生成)
- Create: `data/rules/chapter-40.json` (自動生成)
- Create: `tests/fixtures/chapter-39-cases.json`
- Create: `tests/fixtures/chapter-40-cases.json`
- Create: `tests/chapter-39.test.ts`
- Create: `tests/chapter-40.test.ts`

- [ ] **Step 1: Chapter 39のルールをコンパイル**

```bash
npx tsx compiler/compile-rules.ts --chapter 39 \
  --notes data/notes/chapter-39.md \
  --section-notes data/notes/section-07.md
```

- [ ] **Step 2: Chapter 40のルールをコンパイル**

```bash
npx tsx compiler/compile-rules.ts --chapter 40 \
  --notes data/notes/chapter-40.md \
  --section-notes data/notes/section-07.md
```

- [ ] **Step 3: 出力JSONを目視確認**

- [ ] **Step 4: Chapter 39テストケースを作成**

`tests/fixtures/chapter-39-cases.json` — プラスチック製品を中心に8件:

```json
[
  { "description": "plastic shopping bag, polyethylene", "expected4": "3923", "expected6": "392329", "notes": "articles for conveyance/packing" },
  { "description": "PVC floor covering, roll", "expected4": "3918", "expected6": "391810", "notes": "floor covering of plastics" },
  { "description": "plastic water bottle, 500ml, PET", "expected4": "3923", "expected6": "392330", "notes": "bottles of plastics" },
  { "description": "acrylic sheet, transparent, 3mm thick", "expected4": "3920", "expected6": "392051", "notes": "plates/sheets of polymethyl methacrylate" },
  { "description": "silicone phone case", "expected4": "3926", "expected6": "392690", "notes": "other articles of plastics" },
  { "description": "polyethylene pellets, HDPE, for injection molding", "expected4": "3901", "expected6": "390120", "notes": "polyethylene in primary forms" },
  { "description": "plastic food container with lid, microwave safe", "expected4": "3924", "expected6": "392490", "notes": "tableware/kitchenware of plastics" },
  { "description": "PVC pipe, 50mm diameter, for drainage", "expected4": "3917", "expected6": "391723", "notes": "tubes/pipes of plastics" }
]
```

- [ ] **Step 5: Chapter 40テストケースを作成**

`tests/fixtures/chapter-40-cases.json` — ゴム製品8件:

```json
[
  { "description": "natural rubber latex, concentrated", "expected4": "4001", "expected6": "400110", "notes": "natural rubber latex" },
  { "description": "car tire, radial, 205/55R16", "expected4": "4011", "expected6": "401110", "notes": "new pneumatic tyre for cars" },
  { "description": "rubber gloves, disposable, nitrile", "expected4": "4015", "expected6": "401519", "notes": "rubber gloves" },
  { "description": "rubber O-ring seal, 25mm", "expected4": "4016", "expected6": "401693", "notes": "gaskets/seals of vulcanised rubber" },
  { "description": "conveyor belt, reinforced rubber", "expected4": "4010", "expected6": "401110", "notes": "conveyor belt of vulcanised rubber" },
  { "description": "rubber floor mat for car", "expected4": "4016", "expected6": "401699", "notes": "other articles of vulcanised rubber" },
  { "description": "bicycle inner tube, 26 inch", "expected4": "4013", "expected6": "401320", "notes": "inner tube for bicycles" },
  { "description": "silicone rubber sheet, industrial grade", "expected4": "4002", "expected6": "400270", "notes": "synthetic rubber in primary forms" }
]
```

- [ ] **Step 6: テストファイル作成 (chapter-39.test.ts, chapter-40.test.ts)**

`tests/chapter-84.test.ts` と同じパターンで作成。chapter番号とimportパスを変更。

- [ ] **Step 7: テスト実行 + リグレッションチェック**

```bash
npx vitest run tests/chapter-39.test.ts tests/chapter-40.test.ts
npm test
```

- [ ] **Step 8: コミット**

```bash
git add data/rules/chapter-39.json data/rules/chapter-40.json \
        tests/fixtures/chapter-39-cases.json tests/fixtures/chapter-40-cases.json \
        tests/chapter-39.test.ts tests/chapter-40.test.ts
git commit -m "feat: compile Chapter 39/40 rules + add accuracy tests"
```

---

### Task 10: few-shot更新チェックポイント (Section VII完了後)

Task 7と同じプロセス。Section VIIの例でgeneric.jsonを更新。

- [ ] **Step 1: Section VII のコンパイル結果をレビュー**
- [ ] **Step 2: generic.jsonを更新（良い例があれば、特にプラスチック/ゴムドメインの例を追加）**
- [ ] **Step 3: 更新した場合はコミット**

---

### Task 11: Section XX — Notes構造化 (Chapter 94, 95, 96)

**Files:**
- Create: `data/notes/section-20.md`
- Create: `data/notes/chapter-94.md`
- Create: `data/notes/chapter-95.md`
- Create: `data/notes/chapter-96.md`

- [ ] **Step 1: Section XX Notesを構造化**

Section XX (Miscellaneous Manufactured Articles)。`data/notes/section-20.md` に保存。

- [ ] **Step 2: Chapter 94 Notesを構造化**

`data/notes/chapter-94.md` に保存。

- [ ] **Step 3: Chapter 95 Notesを構造化**

`data/notes/chapter-95.md` に保存。

- [ ] **Step 4: Chapter 96 Notesを構造化**

`data/notes/chapter-96.md` に保存。

- [ ] **Step 5: notes-parserでパース確認**

- [ ] **Step 6: コミット**

```bash
git add data/notes/section-20.md data/notes/chapter-94.md data/notes/chapter-95.md data/notes/chapter-96.md
git commit -m "feat: add Section XX, Chapter 94/95/96 notes for compiler"
```

---

### Task 12: Section XX — ルールコンパイル + テスト (Chapter 94, 95, 96)

**Files:**
- Create: `data/rules/chapter-94.json`, `chapter-95.json`, `chapter-96.json` (自動生成)
- Create: `tests/fixtures/chapter-94-cases.json`, `chapter-95-cases.json`, `chapter-96-cases.json`
- Create: `tests/chapter-94.test.ts`, `tests/chapter-95.test.ts`, `tests/chapter-96.test.ts`

- [ ] **Step 1: Chapter 94/95/96のルールをコンパイル**

```bash
npx tsx compiler/compile-rules.ts --chapter 94 --notes data/notes/chapter-94.md --section-notes data/notes/section-20.md
npx tsx compiler/compile-rules.ts --chapter 95 --notes data/notes/chapter-95.md --section-notes data/notes/section-20.md
npx tsx compiler/compile-rules.ts --chapter 96 --notes data/notes/chapter-96.md --section-notes data/notes/section-20.md
```

- [ ] **Step 2: 出力JSONを目視確認**

- [ ] **Step 3: テストケースを作成**

`tests/fixtures/chapter-94-cases.json` — 家具8件:

```json
[
  { "description": "wooden office desk", "expected4": "9403", "expected6": "940330", "notes": "wooden office furniture" },
  { "description": "LED desk lamp, adjustable arm", "expected4": "9405", "expected6": "940540", "notes": "electric lamp" },
  { "description": "memory foam mattress, queen size", "expected4": "9404", "expected6": "940429", "notes": "mattress" },
  { "description": "upholstered sofa, 3-seater, fabric", "expected4": "9401", "expected6": "940161", "notes": "upholstered seat" },
  { "description": "metal bookshelf, 5 tiers", "expected4": "9403", "expected6": "940320", "notes": "metal furniture" },
  { "description": "prefabricated wooden garden shed", "expected4": "9406", "expected6": "940610", "notes": "prefabricated building" },
  { "description": "baby crib, wooden, convertible", "expected4": "9403", "expected6": "940340", "notes": "wooden kitchen/bedroom furniture" },
  { "description": "outdoor plastic chair, stackable", "expected4": "9401", "expected6": "940180", "notes": "seat of other material" }
]
```

`tests/fixtures/chapter-95-cases.json` — 玩具/スポーツ8件:

```json
[
  { "description": "plastic building blocks toy set for children", "expected4": "9503", "expected6": "950300", "notes": "construction toy set" },
  { "description": "video game console with controllers", "expected4": "9504", "expected6": "950450", "notes": "video game console" },
  { "description": "inflatable swimming pool for kids", "expected4": "9506", "expected6": "950699", "notes": "swimming equipment" },
  { "description": "carbon fiber tennis racket", "expected4": "9506", "expected6": "950651", "notes": "tennis racket" },
  { "description": "stuffed teddy bear plush toy", "expected4": "9503", "expected6": "950300", "notes": "stuffed toy" },
  { "description": "electric toy train set with tracks", "expected4": "9503", "expected6": "950300", "notes": "electric train toy" },
  { "description": "yoga mat, TPE material, 6mm", "expected4": "9506", "expected6": "950691", "notes": "physical exercise equipment" },
  { "description": "jigsaw puzzle, 1000 pieces", "expected4": "9503", "expected6": "950300", "notes": "puzzle" }
]
```

`tests/fixtures/chapter-96-cases.json` — 雑貨6件:

```json
[
  { "description": "toothbrush, nylon bristles", "expected4": "9603", "expected6": "960321", "notes": "toothbrush" },
  { "description": "ballpoint pen, retractable", "expected4": "9608", "expected6": "960810", "notes": "ballpoint pen" },
  { "description": "cigarette lighter, butane, disposable", "expected4": "9613", "expected6": "961310", "notes": "pocket lighter" },
  { "description": "hair comb, plastic", "expected4": "9615", "expected6": "961511", "notes": "comb of hard rubber/plastics" },
  { "description": "paint roller with handle", "expected4": "9603", "expected6": "960340", "notes": "paint roller" },
  { "description": "vacuum flask, stainless steel, 500ml", "expected4": "9617", "expected6": "961700", "notes": "vacuum flask" }
]
```

- [ ] **Step 4: テストファイル作成 (chapter-94/95/96.test.ts)**

`chapter-84.test.ts` と同じパターンで3ファイル作成。

- [ ] **Step 5: テスト実行 + リグレッションチェック**

```bash
npx vitest run tests/chapter-94.test.ts tests/chapter-95.test.ts tests/chapter-96.test.ts
npm test
```

- [ ] **Step 6: コミット**

```bash
git add data/rules/chapter-94.json data/rules/chapter-95.json data/rules/chapter-96.json \
        tests/fixtures/chapter-94-cases.json tests/fixtures/chapter-95-cases.json tests/fixtures/chapter-96-cases.json \
        tests/chapter-94.test.ts tests/chapter-95.test.ts tests/chapter-96.test.ts
git commit -m "feat: compile Chapter 94/95/96 rules + add accuracy tests"
```

---

### Task 13: few-shot更新チェックポイント (Section XX完了後)

- [ ] **Step 1: Section XX のコンパイル結果をレビュー**
- [ ] **Step 2: generic.jsonを更新（良い例があれば）**
- [ ] **Step 3: 更新した場合はコミット**

---

### Task 14: Section XI — Notes構造化 (Chapter 61, 62 のみ)

**Files:**
- Create: `data/notes/chapter-61.md`
- Create: `data/notes/chapter-62.md`
- Create: `data/notes/section-11.md` (部分的、Chapter 61/62に関連するNotesのみ)

Section XI (Textiles and Textile Articles) は巨大。戦略:
- Chapter 61/62のChapter Notesを先行
- Section XI Notesは全体を構造化せず、Chapter 61/62の分類に直接影響する条項のみ抽出

- [ ] **Step 1: Chapter 61 Notesを構造化**

`data/notes/chapter-61.md` に保存。Chapter 61 (Articles of apparel and clothing accessories, knitted or crocheted) のNotes。

- [ ] **Step 2: Chapter 62 Notesを構造化**

`data/notes/chapter-62.md` に保存。Chapter 62 (Articles of apparel and clothing accessories, not knitted or crocheted) のNotes。

- [ ] **Step 3: Section XI Notesを部分構造化**

`data/notes/section-11.md` — Section XI全体ではなく、以下の条項を優先:
- Note 1 (Section scope): 何がSection XIに含まれ何が含まれないか
- Note 14 (Chapter 61/62 scope): 衣類分類の基本ルール
- 繊維混合比率や糸の太さに関する条項は割り切ってスキップ可

- [ ] **Step 4: notes-parserでパース確認**

- [ ] **Step 5: コミット**

```bash
git add data/notes/chapter-61.md data/notes/chapter-62.md data/notes/section-11.md
git commit -m "feat: add Chapter 61/62 notes + partial Section XI notes"
```

---

### Task 15: Section XI — ルールコンパイル + テスト (Chapter 61, 62)

**Files:**
- Create: `data/rules/chapter-61.json`, `chapter-62.json` (自動生成)
- Create: `tests/fixtures/chapter-61-cases.json`, `tests/fixtures/chapter-62-cases.json`
- Create: `tests/chapter-61.test.ts`, `tests/chapter-62.test.ts`

- [ ] **Step 1: Chapter 61/62のルールをコンパイル**

```bash
npx tsx compiler/compile-rules.ts --chapter 61 --notes data/notes/chapter-61.md --section-notes data/notes/section-11.md
npx tsx compiler/compile-rules.ts --chapter 62 --notes data/notes/chapter-62.md --section-notes data/notes/section-11.md
```

- [ ] **Step 2: 出力JSONを目視確認**

- [ ] **Step 3: テストケースを作成**

`tests/fixtures/chapter-61-cases.json` — ニット衣類8件:

```json
[
  { "description": "cotton t-shirt, men's, knitted", "expected4": "6109", "expected6": "610910", "notes": "T-shirts of cotton, knitted" },
  { "description": "women's knitted cardigan, wool", "expected4": "6110", "expected6": "611011", "notes": "jerseys/cardigans, knitted, wool" },
  { "description": "baby's knitted cotton romper", "expected4": "6111", "expected6": "611120", "notes": "babies' garments, knitted, cotton" },
  { "description": "men's knitted boxer shorts, cotton", "expected4": "6107", "expected6": "610711", "notes": "men's underpants, knitted, cotton" },
  { "description": "knitted polyester tracksuit", "expected4": "6112", "expected6": "611231", "notes": "track suit, knitted, synthetic" },
  { "description": "women's knitted silk blouse", "expected4": "6106", "expected6": "610610", "notes": "women's blouse, knitted, cotton/silk" },
  { "description": "knitted cotton socks, men's", "expected4": "6115", "expected6": "611595", "notes": "hosiery, knitted, cotton" },
  { "description": "knitted acrylic beanie hat", "expected4": "6117", "expected6": "611710", "notes": "knitted accessories" }
]
```

`tests/fixtures/chapter-62-cases.json` — 織物衣類8件:

```json
[
  { "description": "men's cotton woven dress shirt", "expected4": "6205", "expected6": "620520", "notes": "men's shirt, woven, cotton" },
  { "description": "women's woven wool skirt", "expected4": "6204", "expected6": "620451", "notes": "women's skirt, woven, wool" },
  { "description": "men's denim jeans, woven cotton", "expected4": "6203", "expected6": "620342", "notes": "men's trousers, woven, cotton" },
  { "description": "silk necktie, woven", "expected4": "6215", "expected6": "621510", "notes": "tie, woven, silk" },
  { "description": "women's woven polyester jacket", "expected4": "6204", "expected6": "620433", "notes": "women's jacket, woven, synthetic" },
  { "description": "cotton bath towel", "expected4": "6302", "expected6": "630260", "notes": "note: 6302 is textile furnishing" },
  { "description": "baby's woven cotton dress", "expected4": "6209", "expected6": "620920", "notes": "babies' garments, woven, cotton" },
  { "description": "men's woven raincoat, synthetic fabric", "expected4": "6201", "expected6": "620113", "notes": "men's overcoat, woven, synthetic" }
]
```

- [ ] **Step 4: テストファイル作成 (chapter-61/62.test.ts)**

- [ ] **Step 5: テスト実行 + リグレッションチェック**

```bash
npx vitest run tests/chapter-61.test.ts tests/chapter-62.test.ts
npm test
```

- [ ] **Step 6: コミット**

```bash
git add data/rules/chapter-61.json data/rules/chapter-62.json \
        tests/fixtures/chapter-61-cases.json tests/fixtures/chapter-62-cases.json \
        tests/chapter-61.test.ts tests/chapter-62.test.ts
git commit -m "feat: compile Chapter 61/62 rules + add accuracy tests"
```

---

### Task 16: 最終few-shot更新 + generic.json仕上げ

- [ ] **Step 1: 全4 Sectionの結果を踏まえgeneric.jsonを最終調整**

各タイプの2件が異なるSectionから取られていることを確認:
- exclusion: Section XVII + Section XVI (or VII/XX)
- definition: Section XVII + Section XI (or VII)
- routing: Section XVII + Section XX (or XVI)
- parts_rule: Section XVII + Section XVI
- scope: Section XVI + Section XX (or VII)

- [ ] **Step 2: Chapter 87でリグレッションチェック**

generic.jsonを更新した場合、Chapter 87のルールを再コンパイルしてテストが通ることを確認:

```bash
npx tsx compiler/compile-rules.ts --chapter 87 --notes data/notes/chapter-87.md --section-notes data/notes/section-17.md
npm test
```

- [ ] **Step 3: コミット**

```bash
git add compiler/few-shot/generic.json
git commit -m "chore: finalize generic few-shot with examples from 4 sections"
```

---

### Task 17: 全体リグレッション + package.jsonの `files` 確認

- [ ] **Step 1: 全テスト実行**

```bash
npm test
```

Expected: 全テスト通過（既存173 + 新規 ~80件）

- [ ] **Step 2: npm pack dry-runでパッケージ内容確認**

```bash
npm run build && npm pack --dry-run
```

Expected: `data/rules/` 配下に全章のJSONが含まれる

- [ ] **Step 3: 精度サマリーの確認**

テスト出力のaccuracy reportを確認し、各章の4桁精度をまとめる。
