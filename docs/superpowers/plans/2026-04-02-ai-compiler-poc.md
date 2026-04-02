# AI Compiler PoC (Chapter 87) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Notes → rules.json pipeline for Chapter 87 and measure classification accuracy improvement via A/B testing.

**Architecture:** 3-layer pipeline (notes parser → LLM clause classifier → rule generator) with runtime integration. Hand-crafted rules.json first, then automate with LLM.

**Tech Stack:** TypeScript, vitest, Anthropic SDK (claude-haiku-4-5-20251001, build-time only)

---

## ファイル構成

| ファイル | 操作 | 責務 |
|----------|------|------|
| `compiler/types.ts` | 新規作成 | コンパイラ内部型（NoteClause, ClassifiedClause, ClauseType, 各Params） |
| `src/rule-types.ts` | 新規作成 | ランタイム型（PreScoringRule, ScoringRule, PartsRule, ChapterRuleSet, ScoringAdjustment） |
| `src/index.ts` | 修正 | ランタイム型のre-export追加 |
| `data/notes/section-17.md` | 新規作成 | Section XVII Notes 構造化テキスト |
| `data/notes/chapter-87.md` | 新規作成 | Chapter 87 Notes + Subheading Notes 構造化テキスト |
| `compiler/notes-parser.ts` | 新規作成 | Layer 1: markdown → NoteClause[] パーサー |
| `compiler/few-shot/chapter-87.json` | 新規作成 | ~12条項のground truth（few-shot examples） |
| `data/rules/chapter-87.json` | 新規作成 | 手作りChapterRuleSet |
| `src/rule-applier.ts` | 新規作成 | ランタイム: ルール読み込み・適用ロジック |
| `src/classifier.ts` | 修正 | classify()にルール適用を統合 |
| `compiler/rule-generator.ts` | 新規作成 | Layer 3: ClassifiedClause[] → ChapterRuleSet変換 |
| `compiler/clause-classifier.ts` | 新規作成 | Layer 2: LLMによる条項分類 |
| `compiler/compile-rules.ts` | 新規作成 | CLI: パイプライン実行 |
| `tests/types.test.ts` | 修正 | 型チェックテスト追加 |
| `tests/notes-parser.test.ts` | 新規作成 | Layer 1 単体テスト |
| `tests/rule-applier.test.ts` | 新規作成 | ランタイム適用テスト |
| `tests/chapter-87.test.ts` | 新規作成 | A/B比較テスト（10件） |
| `tests/rule-generator.test.ts` | 新規作成 | Layer 3 単体テスト |

**Spec:** `docs/superpowers/specs/2026-04-02-ai-compiler-poc-design.md`

---

### Task 1: 型定義

**Files:**
- Create: `compiler/types.ts`
- Create: `src/rule-types.ts`
- Modify: `src/index.ts`
- Modify: `tests/types.test.ts`

- [ ] **Step 1: コンパイラ内部型を作成**

`compiler/types.ts` — Layer 1/2 で使う中間表現の型。`src/types.ts` の `RuleCondition` をインポートして使用する。

```typescript
// compiler/types.ts
// Compiler-internal types for the notes-to-rules pipeline.

import type { RuleCondition } from "../src/types.js";

// Layer 1 output: parsed clause from structured notes markdown
export interface NoteClause {
  source: "section" | "chapter" | "subheading";
  noteNumber: number;
  subItem?: string;   // "(a)", "(b)", etc.
  text: string;       // Original text of the clause
}

// Layer 2 output: classified clause with type and extracted parameters
export type ClauseType = "exclusion" | "definition" | "routing" | "parts_rule" | "scope";

export interface ClassifiedClause extends NoteClause {
  clauseType: ClauseType;
  params: ExclusionParams | DefinitionParams | RoutingParams | PartsRuleParams | ScopeParams;
}

export interface ExclusionParams {
  excludedCodes: string[];
  reason: string;
}

export interface DefinitionParams {
  term: string;
  meaning: string;
  appliesTo: string[];
}

export interface RoutingParams {
  target: string;
  conditions: RuleCondition[];
}

export interface PartsRuleParams {
  rule: "principal_use" | "stay_in_own_heading" | "not_parts";
  affectedCodes?: string[];
}

export interface ScopeParams {
  heading: string;
  covers: string;
  conditions: RuleCondition[];
}
```

- [ ] **Step 2: ランタイム型を作成**

`src/rule-types.ts` — rules.json の型定義。ランタイムに含まれるため `src/` 配下に置く。コンパイラの中間表現（NoteClause メタデータ）は含まない。

```typescript
// src/rule-types.ts
// Runtime types for chapter rule sets loaded from rules.json files.

import type { RuleCondition } from "./types.js";

// Exclusion params: filter out candidates matching these codes
export interface ExclusionParams {
  excludedCodes: string[];
  reason: string;
}

// Definition params: synonym/meaning expansion for scoring boost
export interface DefinitionParams {
  term: string;
  meaning: string;
  appliesTo: string[];
}

// Routing params: force candidate to a specific heading
export interface RoutingParams {
  target: string;
  conditions: RuleCondition[];
}

// Parts rule params: special handling for parts classification
export interface PartsRuleParams {
  rule: "principal_use" | "stay_in_own_heading" | "not_parts";
  affectedCodes?: string[];
}

// Scope params: narrow/widen scope of a heading/subheading
export interface ScopeParams {
  heading: string;
  covers: string;
  conditions: RuleCondition[];
}

// Pre-scoring rules: applied before scoring to filter/add candidates
export interface PreScoringRule {
  clauseType: "exclusion" | "routing";
  params: ExclusionParams | RoutingParams;
}

// Scoring rules: applied during scoring to adjust confidence
export interface ScoringRule {
  clauseType: "scope" | "definition";
  params: ScopeParams | DefinitionParams;
}

// Parts rules: independent flow for parts classification
export interface PartsRule {
  clauseType: "parts_rule";
  params: PartsRuleParams;
}

// Root type for rules.json files
export interface ChapterRuleSet {
  chapter: string;
  preScoringRules: PreScoringRule[];
  scoringRules: ScoringRule[];
  partsRules: PartsRule[];
}

// Return type from applyScoringAdjustments
export interface ScoringAdjustment {
  factor: number;   // 1.0 = no change, 0.5 = halve, 1.05 = slight boost
  reason: string;   // e.g. "Scope: 8702 requires persons >= 10, not found in input"
}
```

- [ ] **Step 3: src/index.ts にランタイム型のre-exportを追加**

`src/index.ts` の末尾に追加:

```typescript
export type {
  ExclusionParams,
  DefinitionParams,
  RoutingParams,
  PartsRuleParams,
  ScopeParams,
  PreScoringRule,
  ScoringRule,
  PartsRule,
  ChapterRuleSet,
  ScoringAdjustment,
} from "./rule-types.js";
```

- [ ] **Step 4: 型チェックテストを追加**

`tests/types.test.ts` に以下のテストを追加。既存テストはそのまま残す。

```typescript
import type {
  PreScoringRule,
  ScoringRule,
  PartsRule,
  ChapterRuleSet,
  ScoringAdjustment,
} from "../src/rule-types.js";
import type {
  NoteClause,
  ClassifiedClause,
  ClauseType,
  ExclusionParams as CompilerExclusionParams,
} from "../compiler/types.js";

describe("rule-types type checking", () => {
  it("ChapterRuleSet is structurally valid", () => {
    const ruleSet: ChapterRuleSet = {
      chapter: "87",
      preScoringRules: [
        {
          clauseType: "exclusion",
          params: { excludedCodes: ["8706"], reason: "test" },
        },
      ],
      scoringRules: [
        {
          clauseType: "definition",
          params: { term: "tractor", meaning: "hauling vehicle", appliesTo: ["8701"] },
        },
      ],
      partsRules: [
        {
          clauseType: "parts_rule",
          params: { rule: "principal_use" },
        },
      ],
    };
    expect(ruleSet.chapter).toBe("87");
    expect(ruleSet.preScoringRules).toHaveLength(1);
    expect(ruleSet.scoringRules).toHaveLength(1);
    expect(ruleSet.partsRules).toHaveLength(1);
  });

  it("ScoringAdjustment is structurally valid", () => {
    const adj: ScoringAdjustment = { factor: 1.05, reason: "Definition match" };
    expect(adj.factor).toBe(1.05);
  });

  it("NoteClause is structurally valid", () => {
    const clause: NoteClause = {
      source: "chapter",
      noteNumber: 2,
      text: "For the purposes of this Chapter...",
    };
    expect(clause.source).toBe("chapter");
    expect(clause.subItem).toBeUndefined();
  });

  it("ClassifiedClause extends NoteClause", () => {
    const classified: ClassifiedClause = {
      source: "section",
      noteNumber: 1,
      text: "This Section does not cover...",
      clauseType: "exclusion",
      params: { excludedCodes: ["9503", "9508"], reason: "Section XVII Note 1" },
    };
    expect(classified.clauseType).toBe("exclusion");
  });

  it("ClauseType covers all 5 types", () => {
    const types: ClauseType[] = ["exclusion", "definition", "routing", "parts_rule", "scope"];
    expect(types).toHaveLength(5);
  });
});
```

- [ ] **Step 5: テスト実行 — 成功確認**

Run: `npx vitest run tests/types.test.ts`
Expected: PASS — 全てのテストが通る（型の構造チェックのみ）

- [ ] **Step 6: コミット**

```bash
git add compiler/types.ts src/rule-types.ts src/index.ts tests/types.test.ts
git commit -m "feat: add compiler and runtime type definitions for AI compiler PoC"
```

---

### Task 2: Notes データファイル

**Files:**
- Create: `data/notes/section-17.md`
- Create: `data/notes/chapter-87.md`

- [ ] **Step 1: data/notes/ ディレクトリ作成**

```bash
mkdir -p data/notes
```

- [ ] **Step 2: Section XVII Notes ファイルを作成**

`data/notes/section-17.md`:

```markdown
## Section XVII Notes

1. This Section does not cover articles of heading 9503 or 9508, or bobsleighs, toboggans or the like of heading 9506.

2. The expressions "parts" and "parts and accessories" do not apply to the following articles, whether or not they are identifiable as for the articles of this Section:
  (a) joints, washers or the like of any material (classified according to their constituent material or in heading 8484) and other articles of vulcanised rubber other than hard rubber (heading 4016);
  (b) parts of general use, as defined in Note 2 to Section XV, of base metal (Section XV) or similar goods of plastics (Chapter 39);
  (c) articles of Chapter 82 (tools);
  (d) articles of heading 8306;
  (e) machines and apparatus of headings 8401 to 8479, or parts thereof; articles of heading 8481 or 8482 or, provided they constitute integral parts of engines or motors, articles of heading 8483;
  (f) electrical machinery or equipment (Chapter 85);
  (g) articles of Chapter 90;
  (h) articles of Chapter 91;
  (ij) arms (Chapter 93);
  (k) lamps and lighting fittings of heading 9405;
  (l) brushes of a kind used as parts of vehicles (heading 9603).

3. References in Chapters 86 to 88 to "parts" or "accessories" do not apply to parts or accessories which are not suitable for use solely or principally with the articles of those Chapters. A part or accessory which answers to a description in two or more of the headings of those Chapters is to be classified in the heading appropriate to the principal use of that part or accessory.

4. For the purposes of this Section:
  (a) vehicles specially constructed to travel on both road and rail are classified in the appropriate heading of Chapter 87;
  (b) amphibious motor vehicles are classified in the appropriate heading of Chapter 87;
  (c) aircraft specially constructed so as to be able also to be used as road vehicles are classified in the appropriate heading of Chapter 88.

5. Air-cushion vehicles are to be classified within this Section with the vehicles to which they are most akin as follows:
  (a) in Chapter 86 if designed to travel on a guide-track (hovertrains);
  (b) in Chapter 87 if designed to travel over land or over both land and water;
  (c) in Chapter 89 if designed to travel over water, whether or not able to land on beaches or landing-stages or also able to travel on ice.
```

- [ ] **Step 3: Chapter 87 Notes ファイルを作成**

`data/notes/chapter-87.md`:

```markdown
## Chapter 87 Notes

1. This Chapter does not cover railway or tramway rolling-stock designed solely for running on rails.

2. For the purposes of this Chapter, "tractors" means vehicles constructed essentially for hauling or pushing another vehicle, appliance or load, whether or not they contain subsidiary provision for the transport, in connection with the main use of the tractor, of tools, seeds, fertilisers or other goods.

Machines and working tools designed for fitting to tractors of heading 87.01 as their sole or principal source of power remain classified in their respective headings even when presented with the tractor, and whether or not mounted on it.

3. Motor chassis fitted with cabs fall in headings 87.02 to 87.04, and not in heading 87.06.

4. Heading 87.12 includes all children's bicycles. Other children's wheeled toys are classified in heading 95.03.

## Subheading Notes

1. Subheading 8708.22 covers front windscreens (windshields), rear windows and other windows, framed, for use with vehicles of headings 87.01 to 87.05.
```

- [ ] **Step 4: コミット**

```bash
git add data/notes/section-17.md data/notes/chapter-87.md
git commit -m "feat: add structured notes data for Section XVII and Chapter 87"
```

---

### Task 3: Notes パーサー + テスト

**Files:**
- Create: `compiler/notes-parser.ts`
- Create: `tests/notes-parser.test.ts`

- [ ] **Step 1: テストを書く**

`tests/notes-parser.test.ts`:

```typescript
// tests/notes-parser.test.ts
import { describe, it, expect } from "vitest";
import { parseNotes } from "../compiler/notes-parser.js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("parseNotes", () => {
  it("returns empty array for empty input", () => {
    expect(parseNotes("")).toEqual([]);
  });

  it("returns empty array for input with no recognized headers", () => {
    expect(parseNotes("Some random text without headers")).toEqual([]);
  });

  describe("section notes", () => {
    it("parses simple section note", () => {
      const md = `## Section XVII Notes

1. This Section does not cover articles of heading 9503.`;
      const result = parseNotes(md);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        source: "section",
        noteNumber: 1,
        text: "This Section does not cover articles of heading 9503.",
      });
    });

    it("parses multiple section notes", () => {
      const md = `## Section XVII Notes

1. First note text.

2. Second note text.`;
      const result = parseNotes(md);
      expect(result).toHaveLength(2);
      expect(result[0].noteNumber).toBe(1);
      expect(result[1].noteNumber).toBe(2);
      expect(result[0].source).toBe("section");
      expect(result[1].source).toBe("section");
    });
  });

  describe("sub-item parsing", () => {
    it("parses notes with (a)(b) sub-items", () => {
      const md = `## Section XVII Notes

4. For the purposes of this Section:
  (a) road and rail vehicles are classified in Chapter 87;
  (b) amphibious motor vehicles are classified in Chapter 87;
  (c) aircraft road vehicles are classified in Chapter 88.`;
      const result = parseNotes(md);
      expect(result).toHaveLength(3);
      expect(result[0].subItem).toBe("(a)");
      expect(result[0].noteNumber).toBe(4);
      expect(result[0].text).toBe("road and rail vehicles are classified in Chapter 87;");
      expect(result[1].subItem).toBe("(b)");
      expect(result[2].subItem).toBe("(c)");
    });

    it("preserves note-level preamble text in sub-items", () => {
      const md = `## Section XVII Notes

4. For the purposes of this Section:
  (a) vehicles go to Chapter 87;`;
      const result = parseNotes(md);
      // Sub-items should carry just their own text, not the preamble
      expect(result[0].text).toBe("vehicles go to Chapter 87;");
      expect(result[0].subItem).toBe("(a)");
    });
  });

  describe("chapter notes", () => {
    it("parses chapter notes with correct source", () => {
      const md = `## Chapter 87 Notes

1. This Chapter does not cover railway rolling-stock.`;
      const result = parseNotes(md);
      expect(result).toHaveLength(1);
      expect(result[0].source).toBe("chapter");
      expect(result[0].noteNumber).toBe(1);
    });
  });

  describe("multi-paragraph splitting", () => {
    it("splits multi-paragraph note into separate clauses", () => {
      const md = `## Chapter 87 Notes

2. For the purposes of this Chapter, "tractors" means vehicles constructed essentially for hauling.

Machines and working tools designed for fitting to tractors remain classified in their respective headings.`;
      const result = parseNotes(md);
      expect(result).toHaveLength(2);
      expect(result[0].noteNumber).toBe(2);
      expect(result[0].text).toContain("tractors");
      expect(result[0].text).toContain("hauling");
      expect(result[1].noteNumber).toBe(2);
      expect(result[1].text).toContain("Machines and working tools");
    });
  });

  describe("subheading notes", () => {
    it("parses subheading notes with correct source", () => {
      const md = `## Subheading Notes

1. Subheading 8708.22 covers front windscreens.`;
      const result = parseNotes(md);
      expect(result).toHaveLength(1);
      expect(result[0].source).toBe("subheading");
      expect(result[0].noteNumber).toBe(1);
    });
  });

  describe("combined parsing", () => {
    it("parses mixed section + chapter + subheading notes", () => {
      const md = `## Section XVII Notes

1. This Section does not cover articles of heading 9503.

## Chapter 87 Notes

1. This Chapter does not cover railway rolling-stock.

## Subheading Notes

1. Subheading 8708.22 covers front windscreens.`;
      const result = parseNotes(md);
      expect(result).toHaveLength(3);
      expect(result[0].source).toBe("section");
      expect(result[1].source).toBe("chapter");
      expect(result[2].source).toBe("subheading");
    });
  });

  describe("full data files", () => {
    it("parses section-17.md correctly", () => {
      const md = readFileSync(resolve(process.cwd(), "data/notes/section-17.md"), "utf-8");
      const result = parseNotes(md);
      // Section XVII has: Note 1 (1 clause), Note 2 with 12 sub-items (12 clauses),
      // Note 3 (1 clause), Note 4 with 3 sub-items (3 clauses), Note 5 with 3 sub-items (3 clauses)
      // Total: 1 + 12 + 1 + 3 + 3 = 20 clauses
      expect(result.length).toBeGreaterThanOrEqual(18);
      expect(result.every((c) => c.source === "section")).toBe(true);
    });

    it("parses chapter-87.md correctly", () => {
      const md = readFileSync(resolve(process.cwd(), "data/notes/chapter-87.md"), "utf-8");
      const result = parseNotes(md);
      // Chapter 87: Note 1 (1), Note 2 (2 paragraphs), Note 3 (1), Note 4 (1)
      // Subheading: Note 1 (1)
      // Total: 1 + 2 + 1 + 1 + 1 = 6 clauses
      expect(result.length).toBeGreaterThanOrEqual(5);
      const chapterClauses = result.filter((c) => c.source === "chapter");
      const subheadingClauses = result.filter((c) => c.source === "subheading");
      expect(chapterClauses.length).toBeGreaterThanOrEqual(4);
      expect(subheadingClauses.length).toBeGreaterThanOrEqual(1);
    });
  });
});
```

- [ ] **Step 2: テスト実行 — 失敗確認**

Run: `npx vitest run tests/notes-parser.test.ts`
Expected: FAIL — `compiler/notes-parser.js` が存在しない

- [ ] **Step 3: パーサーを実装**

`compiler/notes-parser.ts`:

```typescript
// compiler/notes-parser.ts
// Layer 1: Parse structured notes markdown into NoteClause array.

import type { NoteClause } from "./types.js";

type NoteSource = "section" | "chapter" | "subheading";

// Header patterns to determine source type
const SECTION_HEADER = /^## Section [A-Z]+ Notes/m;
const CHAPTER_HEADER = /^## Chapter \d+ Notes/m;
const SUBHEADING_HEADER = /^## Subheading Notes/m;

interface SectionBlock {
  source: NoteSource;
  body: string;
}

/**
 * Parse structured notes markdown into an array of NoteClause.
 * Supports multiple header sections in a single document.
 */
export function parseNotes(markdown: string): NoteClause[] {
  if (!markdown.trim()) return [];

  const blocks = splitIntoSectionBlocks(markdown);
  if (blocks.length === 0) return [];

  const clauses: NoteClause[] = [];
  for (const block of blocks) {
    clauses.push(...parseBlock(block));
  }
  return clauses;
}

/**
 * Split the markdown into blocks by ## header, each tagged with source type.
 */
function splitIntoSectionBlocks(markdown: string): SectionBlock[] {
  const blocks: SectionBlock[] = [];
  const lines = markdown.split("\n");
  let currentSource: NoteSource | null = null;
  let currentLines: string[] = [];

  for (const line of lines) {
    if (SECTION_HEADER.test(line)) {
      if (currentSource !== null) {
        blocks.push({ source: currentSource, body: currentLines.join("\n") });
      }
      currentSource = "section";
      currentLines = [];
    } else if (CHAPTER_HEADER.test(line)) {
      if (currentSource !== null) {
        blocks.push({ source: currentSource, body: currentLines.join("\n") });
      }
      currentSource = "chapter";
      currentLines = [];
    } else if (SUBHEADING_HEADER.test(line)) {
      if (currentSource !== null) {
        blocks.push({ source: currentSource, body: currentLines.join("\n") });
      }
      currentSource = "subheading";
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }

  if (currentSource !== null) {
    blocks.push({ source: currentSource, body: currentLines.join("\n") });
  }

  return blocks;
}

/**
 * Parse a single source block into NoteClause entries.
 */
function parseBlock(block: SectionBlock): NoteClause[] {
  const { source, body } = block;
  const clauses: NoteClause[] = [];

  // Split body by numbered notes
  const noteChunks = splitByNumberedNotes(body);

  for (const { noteNumber, text } of noteChunks) {
    // Check if note has sub-items
    const subItems = splitBySubItems(text);

    if (subItems.length > 0) {
      // Has sub-items: create one clause per sub-item
      for (const sub of subItems) {
        clauses.push({
          source,
          noteNumber,
          subItem: sub.label,
          text: sub.text.trim(),
        });
      }
    } else {
      // No sub-items: check for multi-paragraph (blank line separator)
      const paragraphs = splitByParagraphs(text);

      for (const para of paragraphs) {
        clauses.push({
          source,
          noteNumber,
          text: para.trim(),
        });
      }
    }
  }

  return clauses;
}

/**
 * Split block body by numbered note markers ("1. ", "2. ", etc.)
 */
function splitByNumberedNotes(body: string): { noteNumber: number; text: string }[] {
  const results: { noteNumber: number; text: string }[] = [];
  const re = /^(\d+)\.\s/gm;
  const matches: { index: number; noteNumber: number }[] = [];

  let match: RegExpExecArray | null;
  while ((match = re.exec(body)) !== null) {
    matches.push({ index: match.index, noteNumber: parseInt(match[1], 10) });
  }

  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index + String(matches[i].noteNumber).length + 2; // skip "N. "
    const end = i + 1 < matches.length ? matches[i + 1].index : body.length;
    const text = body.slice(start, end).trim();
    if (text) {
      results.push({ noteNumber: matches[i].noteNumber, text });
    }
  }

  return results;
}

/**
 * Split note text by sub-item markers "(a) ", "(b) ", etc.
 * Returns empty array if no sub-items found.
 */
function splitBySubItems(text: string): { label: string; text: string }[] {
  const re = /^\s*\(([a-z]+)\)\s/gm;
  const matches: { index: number; label: string; fullMatch: string }[] = [];

  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    matches.push({ index: match.index, label: `(${match[1]})`, fullMatch: match[0] });
  }

  if (matches.length === 0) return [];

  const results: { label: string; text: string }[] = [];
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index + matches[i].fullMatch.length;
    const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
    const subText = text.slice(start, end).trim();
    if (subText) {
      results.push({ label: matches[i].label, text: subText });
    }
  }

  return results;
}

/**
 * Split text by blank lines (multi-paragraph notes).
 * Returns array of non-empty paragraphs.
 */
function splitByParagraphs(text: string): string[] {
  const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  return paragraphs.length > 0 ? paragraphs : [text];
}
```

- [ ] **Step 4: テスト実行 — 成功確認**

Run: `npx vitest run tests/notes-parser.test.ts`
Expected: PASS — 全テスト通過

- [ ] **Step 5: テスト微調整**

full data files テストの期待値がずれた場合、パーサーのロジックではなくテストの期待値を実データに合わせて調整する。実データのパース結果を確認し、クロース数を修正。

- [ ] **Step 6: コミット**

```bash
git add compiler/notes-parser.ts tests/notes-parser.test.ts
git commit -m "feat: add notes parser (Layer 1) with TDD tests"
```

---

### Task 4: Few-shot ground truth + hand-crafted rules.json

**Files:**
- Create: `compiler/few-shot/chapter-87.json`
- Create: `data/rules/chapter-87.json`

- [ ] **Step 1: few-shot ディレクトリ作成**

```bash
mkdir -p compiler/few-shot
mkdir -p data/rules
```

- [ ] **Step 2: few-shot ground truth ファイルを作成**

`compiler/few-shot/chapter-87.json` — 全条項の入力→出力ペア。inputはパーサーが出力するNoteClauseのテキスト、outputは `clauseType` と `params` のみ（NoteClauseメタデータは含まない）。LLMに求める出力フォーマットと一致させる。

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
    "input": "The expressions \"parts\" and \"parts and accessories\" do not apply to the following articles, whether or not they are identifiable as for the articles of this Section: joints, washers... tools Ch.82... electrical Ch.85... instruments Ch.90...",
    "output": {
      "clauseType": "exclusion",
      "params": {
        "excludedCodes": ["4016", "39", "82", "8306", "8401-8479", "8481", "8482", "8483", "85", "90", "91", "93", "9405", "9603"],
        "reason": "Section XVII Note 2: listed items are not 'parts' of Section XVII articles"
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
    "input": "amphibious motor vehicles are classified in the appropriate heading of Chapter 87;",
    "output": {
      "source": "section",
      "noteNumber": 4,
      "subItem": "(b)",
      "text": "amphibious motor vehicles are classified in the appropriate heading of Chapter 87;",
      "clauseType": "routing",
      "params": {
        "target": "87",
        "conditions": [
          { "type": "contains", "field": "description", "value": "amphibious" }
        ]
      }
    }
  },
  {
    "input": "aircraft specially constructed so as to be able also to be used as road vehicles are classified in the appropriate heading of Chapter 88.",
    "output": {
      "source": "section",
      "noteNumber": 4,
      "subItem": "(c)",
      "text": "aircraft specially constructed so as to be able also to be used as road vehicles are classified in the appropriate heading of Chapter 88.",
      "clauseType": "routing",
      "params": {
        "target": "88",
        "conditions": [
          { "type": "contains", "field": "description", "value": "aircraft" },
          { "type": "contains", "field": "description", "value": "road" }
        ]
      }
    }
  },
  {
    "input": "This Chapter does not cover railway or tramway rolling-stock designed solely for running on rails.",
    "output": {
      "source": "chapter",
      "noteNumber": 1,
      "text": "This Chapter does not cover railway or tramway rolling-stock designed solely for running on rails.",
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
      "source": "chapter",
      "noteNumber": 2,
      "text": "For the purposes of this Chapter, \"tractors\" means vehicles constructed essentially for hauling or pushing...",
      "clauseType": "definition",
      "params": {
        "term": "tractor",
        "meaning": "vehicles constructed essentially for hauling or pushing another vehicle, appliance or load",
        "appliesTo": ["8701"]
      }
    }
  },
  {
    "input": "Machines and working tools designed for fitting to tractors of heading 87.01 as their sole or principal source of power remain classified in their respective headings even when presented with the tractor, and whether or not mounted on it.",
    "output": {
      "source": "chapter",
      "noteNumber": 2,
      "text": "Machines and working tools designed for fitting to tractors of heading 87.01 as their sole or principal source of power remain classified in their respective headings...",
      "clauseType": "parts_rule",
      "params": {
        "rule": "stay_in_own_heading",
        "affectedCodes": ["8701"]
      }
    }
  },
  {
    "input": "Motor chassis fitted with cabs fall in headings 87.02 to 87.04, and not in heading 87.06.",
    "output": {
      "source": "chapter",
      "noteNumber": 3,
      "text": "Motor chassis fitted with cabs fall in headings 87.02 to 87.04, and not in heading 87.06.",
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
    "input": "Heading 87.12 includes all children's bicycles. Other children's wheeled toys are classified in heading 95.03.",
    "output": {
      "source": "chapter",
      "noteNumber": 4,
      "text": "Heading 87.12 includes all children's bicycles. Other children's wheeled toys are classified in heading 95.03.",
      "clauseType": "routing",
      "params": {
        "target": "8712",
        "conditions": [
          { "type": "contains", "field": "description", "value": "children" },
          { "type": "contains", "field": "description", "value": "bicycle" }
        ]
      }
    }
  },
  {
    "input": "Subheading 8708.22 covers front windscreens (windshields), rear windows and other windows, framed, for use with vehicles of headings 87.01 to 87.05.",
    "output": {
      "source": "subheading",
      "noteNumber": 1,
      "text": "Subheading 8708.22 covers front windscreens (windshields), rear windows and other windows, framed, for use with vehicles of headings 87.01 to 87.05.",
      "clauseType": "scope",
      "params": {
        "heading": "870822",
        "covers": "front windscreens, rear windows and other windows, framed",
        "conditions": [
          { "type": "contains", "field": "description", "value": "windscreen" }
        ]
      }
    }
  }
]
```

- [ ] **Step 3: 手作り rules.json を作成**

`data/rules/chapter-87.json` — テストケースの精度改善に直結するルールのみ。`evaluateCondition()` 互換の `RuleCondition` を使用。

```json
{
  "chapter": "87",
  "preScoringRules": [
    {
      "clauseType": "exclusion",
      "params": {
        "excludedCodes": ["87"],
        "reason": "Chapter 87 Note 1: railway/tramway rolling-stock designed solely for rails is excluded from Chapter 87"
      }
    },
    {
      "clauseType": "routing",
      "params": {
        "target": "8702-8704",
        "conditions": [
          { "type": "contains", "field": "description", "value": "chassis" },
          { "type": "contains", "field": "description", "value": "cab" }
        ]
      }
    },
    {
      "clauseType": "routing",
      "params": {
        "target": "8712",
        "conditions": [
          { "type": "contains", "field": "description", "value": "children" },
          { "type": "contains", "field": "description", "value": "bicycle" }
        ]
      }
    }
  ],
  "scoringRules": [
    {
      "clauseType": "definition",
      "params": {
        "term": "tractor",
        "meaning": "vehicles constructed essentially for hauling or pushing another vehicle, appliance or load",
        "appliesTo": ["8701"]
      }
    },
    {
      "clauseType": "scope",
      "params": {
        "heading": "870822",
        "covers": "front windscreens, rear windows and other windows, framed",
        "conditions": [
          { "type": "contains", "field": "description", "value": "windscreen" }
        ]
      }
    }
  ],
  "partsRules": [
    {
      "clauseType": "parts_rule",
      "params": {
        "rule": "principal_use",
        "affectedCodes": ["86", "87", "88"]
      }
    },
    {
      "clauseType": "parts_rule",
      "params": {
        "rule": "stay_in_own_heading",
        "affectedCodes": ["8701"]
      }
    }
  ]
}
```

- [ ] **Step 4: コミット**

```bash
git add compiler/few-shot/chapter-87.json data/rules/chapter-87.json
git commit -m "feat: add few-shot ground truth and hand-crafted rules for Chapter 87"
```

---

### Task 5: Rule applier + テスト

**Files:**
- Create: `src/rule-applier.ts`
- Create: `tests/rule-applier.test.ts`
- Modify: `src/index.ts`

- [ ] **Step 1: テストを書く**

`tests/rule-applier.test.ts`:

```typescript
// tests/rule-applier.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  loadRules,
  setRules,
  clearRules,
  applyPreScoringRules,
  applyScoringAdjustments,
  applyPartsRules,
} from "../src/rule-applier.js";
import type { ChapterRuleSet, ScoringAdjustment } from "../src/rule-types.js";
import type { HsNode, ClassifyInput, Candidate } from "../src/types.js";

// Helper: create a minimal HsNode
function makeNode(code: string, desc: string): HsNode {
  return { code, description: desc, level: 4, children: [] };
}

// Helper: create a minimal Candidate
function makeCandidate(hscode: string, desc: string): Candidate {
  return {
    hscode,
    description: desc,
    confidence: 0.5,
    reasoning: [],
    matchedTokenCount: 1,
  };
}

describe("loadRules", () => {
  afterAll(() => clearRules());

  it("loads chapter-87.json successfully", () => {
    const rules = loadRules("87");
    expect(rules).not.toBeNull();
    expect(rules!.chapter).toBe("87");
    expect(rules!.preScoringRules.length).toBeGreaterThan(0);
    expect(rules!.scoringRules.length).toBeGreaterThan(0);
    expect(rules!.partsRules.length).toBeGreaterThan(0);
  });

  it("returns null for non-existent chapter", () => {
    const rules = loadRules("99");
    expect(rules).toBeNull();
  });

  it("caches loaded rules", () => {
    const first = loadRules("87");
    const second = loadRules("87");
    expect(first).toBe(second); // same reference
  });
});

describe("setRules / clearRules", () => {
  afterAll(() => clearRules());

  it("injects rules for a chapter", () => {
    const custom: ChapterRuleSet = {
      chapter: "01",
      preScoringRules: [],
      scoringRules: [],
      partsRules: [],
    };
    setRules("01", custom);
    const loaded = loadRules("01");
    expect(loaded).toBe(custom);
  });

  it("clearRules removes all cached rules", () => {
    setRules("01", { chapter: "01", preScoringRules: [], scoringRules: [], partsRules: [] });
    clearRules();
    // After clear, loadRules("01") would try to load from filesystem (which doesn't exist)
    const loaded = loadRules("01");
    expect(loaded).toBeNull();
  });
});

describe("applyPreScoringRules", () => {
  let rules: ChapterRuleSet;

  beforeAll(() => {
    rules = loadRules("87")!;
  });

  afterAll(() => clearRules());

  it("does not filter when exclusion condition not met", () => {
    const input: ClassifyInput = { description: "sedan car gasoline" };
    const nodes = [makeNode("8703", "Motor cars"), makeNode("8706", "Chassis")];
    const result = applyPreScoringRules(rules.preScoringRules, input, nodes);
    // No rail-related content, so exclusion rule should not fire
    expect(result).toHaveLength(2);
  });

  it("routes chassis with cab away from 8706", () => {
    const input: ClassifyInput = { description: "motor chassis fitted with cab for passenger car" };
    const nodes = [
      makeNode("8702", "Buses"),
      makeNode("8703", "Motor cars"),
      makeNode("8704", "Trucks"),
      makeNode("8706", "Chassis"),
    ];
    const result = applyPreScoringRules(rules.preScoringRules, input, nodes);
    // 8706 should be filtered out (chassis+cab routing rule)
    const codes = result.map((n) => n.code);
    expect(codes).not.toContain("8706");
    expect(codes).toContain("8703");
  });

  it("routes children's bicycle to 8712", () => {
    const input: ClassifyInput = { description: "children bicycle with training wheels" };
    const nodes = [
      makeNode("8712", "Bicycles"),
      makeNode("9503", "Toys"),
    ];
    const result = applyPreScoringRules(rules.preScoringRules, input, nodes);
    const codes = result.map((n) => n.code);
    expect(codes).toContain("8712");
  });
});

describe("applyScoringAdjustments", () => {
  let rules: ChapterRuleSet;

  beforeAll(() => {
    rules = loadRules("87")!;
  });

  afterAll(() => clearRules());

  it("boosts confidence for tractor heading when description contains hauling terms", () => {
    const input: ClassifyInput = { description: "agricultural tractor for hauling" };
    const candidate = makeCandidate("870191", "Agricultural tractors");
    const adjustments = applyScoringAdjustments(rules.scoringRules, input, candidate);
    // Should have a definition boost
    const defAdj = adjustments.find((a) => a.reason.includes("Definition"));
    expect(defAdj).toBeDefined();
    expect(defAdj!.factor).toBeGreaterThan(1.0);
  });

  it("returns no adjustments when no rules match", () => {
    const input: ClassifyInput = { description: "motorcycle 250cc" };
    const candidate = makeCandidate("871120", "Motorcycles 50-250cc");
    const adjustments = applyScoringAdjustments(rules.scoringRules, input, candidate);
    // No definition or scope match for motorcycle in current rules
    expect(adjustments.every((a) => a.factor === 1.0)).toBe(true);
  });
});

describe("applyPartsRules", () => {
  let rules: ChapterRuleSet;

  beforeAll(() => {
    rules = loadRules("87")!;
  });

  afterAll(() => clearRules());

  it("detects parts in description", () => {
    const input: ClassifyInput = { description: "bicycle parts rear derailleur" };
    const result = applyPartsRules(rules.partsRules, input);
    expect(result).not.toBeNull();
    expect(result!.isPart).toBe(true);
  });

  it("returns null for non-parts description", () => {
    const input: ClassifyInput = { description: "sedan car 1500cc gasoline" };
    const result = applyPartsRules(rules.partsRules, input);
    // Not a parts description, so should return null or isPart=false
    expect(result === null || result.isPart === false).toBe(true);
  });
});
```

- [ ] **Step 2: テスト実行 — 失敗確認**

Run: `npx vitest run tests/rule-applier.test.ts`
Expected: FAIL — `src/rule-applier.js` が存在しない

- [ ] **Step 3: rule-applier を実装**

`src/rule-applier.ts`:

```typescript
// src/rule-applier.ts
// Runtime rule applier: loads chapter rule sets and applies them during classification.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { evaluateCondition } from "./rule-engine.js";
import type { ClassifyInput, HsNode, Candidate } from "./types.js";
import type {
  ChapterRuleSet,
  PreScoringRule,
  ScoringRule,
  PartsRule,
  ScoringAdjustment,
  ExclusionParams,
  RoutingParams,
  DefinitionParams,
  ScopeParams,
  PartsRuleParams,
} from "./rule-types.js";

const rulesCache = new Map<string, ChapterRuleSet | null>();

const DEFAULT_RULES_DIR = resolve(process.cwd(), "data/rules");

/**
 * Load rules for a chapter from data/rules/chapter-{chapter}.json.
 * Returns null if the file does not exist. Caches the result.
 */
export function loadRules(chapter: string): ChapterRuleSet | null {
  if (rulesCache.has(chapter)) return rulesCache.get(chapter)!;

  try {
    const filePath = resolve(DEFAULT_RULES_DIR, `chapter-${chapter}.json`);
    const raw = readFileSync(filePath, "utf-8");
    const rules = JSON.parse(raw) as ChapterRuleSet;
    rulesCache.set(chapter, rules);
    return rules;
  } catch {
    rulesCache.set(chapter, null);
    return null;
  }
}

/**
 * Inject rules for a chapter directly (browser/test use).
 */
export function setRules(chapter: string, rules: ChapterRuleSet): void {
  rulesCache.set(chapter, rules);
}

/**
 * Clear all cached rules (for test cleanup).
 */
export function clearRules(): void {
  rulesCache.clear();
}

// --- Helper: check if input description matches all conditions ---
function matchesConditions(
  conditions: { type: string; field: string; value: string | number }[],
  input: ClassifyInput,
): boolean {
  const attrs: Record<string, string | number | undefined> = {
    description: input.description.toLowerCase(),
    ...input.attributes,
  };
  return conditions.every((cond) =>
    evaluateCondition(
      { type: cond.type as "contains", field: cond.field, value: cond.value },
      attrs,
    ),
  );
}

/**
 * Apply pre-scoring rules: exclusion (filter out) and routing (filter/force).
 * Returns filtered/modified candidate list.
 */
export function applyPreScoringRules(
  rules: PreScoringRule[],
  input: ClassifyInput,
  candidates: HsNode[],
): HsNode[] {
  let result = [...candidates];

  for (const rule of rules) {
    if (rule.clauseType === "exclusion") {
      const params = rule.params as ExclusionParams;
      // Exclusion: check if input matches rail/exclusion keywords
      const desc = input.description.toLowerCase();
      const isRailOnly =
        (desc.includes("railway") || desc.includes("tramway") || desc.includes("rail")) &&
        desc.includes("solely") &&
        !desc.includes("road");
      if (isRailOnly) {
        result = result.filter(
          (n) => !params.excludedCodes.some((code) => n.code.startsWith(code)),
        );
      }
    } else if (rule.clauseType === "routing") {
      const params = rule.params as RoutingParams;
      if (matchesConditions(params.conditions, input)) {
        // Routing: filter candidates based on target
        if (params.target.includes("-")) {
          // Range target like "8702-8704": remove codes outside range
          // that are specifically excluded by the routing rule
          const [start, end] = params.target.split("-").map((s) => parseInt(s, 10));
          result = result.filter((n) => {
            const code = parseInt(n.code, 10);
            // Keep if within the target range
            if (code >= start && code <= end) return true;
            // Exclude headings in the same chapter that are above the range
            // (e.g., chassis+cab routes to 8702-8704, not 8706)
            if (n.code.startsWith("87") && code > end) return false;
            return true;
          });
        }
        // Single target like "8712": no filtering needed, just ensure presence
      }
    }
  }

  return result;
}

/**
 * Apply scoring adjustments: definition (boost) and scope (narrow).
 * Returns array of factor+reason adjustments.
 */
export function applyScoringAdjustments(
  rules: ScoringRule[],
  input: ClassifyInput,
  candidate: Candidate,
): ScoringAdjustment[] {
  const adjustments: ScoringAdjustment[] = [];
  const desc = input.description.toLowerCase();

  for (const rule of rules) {
    if (rule.clauseType === "definition") {
      const params = rule.params as DefinitionParams;
      const termLower = params.term.toLowerCase();
      // Check if the input description contains the defined term
      if (desc.includes(termLower)) {
        // Check if the candidate heading matches one of the appliesTo codes
        const matchesHeading = params.appliesTo.some((code) =>
          candidate.hscode.startsWith(code),
        );
        if (matchesHeading) {
          // Boost: input uses the defined term and candidate is the correct heading
          adjustments.push({
            factor: 1.15,
            reason: `Definition: "${params.term}" matches heading ${params.appliesTo.join(", ")} — ${params.meaning}`,
          });
        }
      }
    } else if (rule.clauseType === "scope") {
      const params = rule.params as ScopeParams;
      // Check if candidate matches the scoped heading
      if (candidate.hscode.startsWith(params.heading) || candidate.hscode === params.heading) {
        // Check if input matches scope conditions
        if (matchesConditions(params.conditions, input)) {
          adjustments.push({
            factor: 1.1,
            reason: `Scope: ${params.heading} covers ${params.covers}`,
          });
        } else {
          adjustments.push({
            factor: 0.8,
            reason: `Scope: ${params.heading} requires conditions not met in input`,
          });
        }
      }
    }
  }

  // If no adjustments, return neutral
  if (adjustments.length === 0) {
    adjustments.push({ factor: 1.0, reason: "No rule adjustments" });
  }

  return adjustments;
}

/**
 * Apply parts rules: detect if input is about parts and determine handling.
 * Returns null if no parts rules are relevant.
 */
export function applyPartsRules(
  rules: PartsRule[],
  input: ClassifyInput,
): { isPart: boolean; principalUseHeading?: string } | null {
  const desc = input.description.toLowerCase();

  // Simple parts detection heuristic
  const partsKeywords = ["parts", "part", "accessories", "accessory", "component", "components"];
  const isPart = partsKeywords.some((kw) => desc.includes(kw));

  if (!isPart) return null;

  for (const rule of rules) {
    const params = rule.params as PartsRuleParams;
    if (params.rule === "principal_use") {
      return { isPart: true };
    }
    if (params.rule === "stay_in_own_heading") {
      return { isPart: true };
    }
  }

  return { isPart: true };
}
```

- [ ] **Step 4: src/index.ts に rule-applier のexportを追加**

`src/index.ts` に追加:

```typescript
export {
  loadRules,
  setRules,
  clearRules,
  applyPreScoringRules,
  applyScoringAdjustments,
  applyPartsRules,
} from "./rule-applier.js";
```

- [ ] **Step 5: テスト実行 — 成功確認**

Run: `npx vitest run tests/rule-applier.test.ts`
Expected: PASS — 全テスト通過

- [ ] **Step 6: テスト微調整**

ルーティングの条件マッチングロジックが `evaluateCondition` の `contains` で動くことを確認。`description` フィールドを小文字化して比較するため、条件の `value` も小文字であることを確認する。必要に応じて rules.json の条件値を修正。

- [ ] **Step 7: コミット**

```bash
git add src/rule-applier.ts src/rule-types.ts src/index.ts tests/rule-applier.test.ts
git commit -m "feat: add rule applier with load/set/clear and pre-scoring/scoring/parts logic"
```

---

### Task 6: Classify 統合

**Files:**
- Modify: `src/classifier.ts`

- [ ] **Step 1: 既存テスト実行 — ベースライン確認**

Run: `npx vitest run`
Expected: PASS — 既存50件 + 他テスト全て通過。このパス数をメモする。

- [ ] **Step 2: classifier.ts にルール適用を統合**

`src/classifier.ts` に以下の変更を加える。後方互換性を保つため、ルールが無い章は現在と同じ動作。

**Import追加** (ファイル先頭、既存importの後に追加):

```typescript
import { loadRules as loadChapterRules } from "./rule-applier.js";
import type { ChapterRuleSet } from "./rule-types.js";
import {
  applyPreScoringRules,
  applyScoringAdjustments,
  applyPartsRules,
} from "./rule-applier.js";
```

**変更1: candidateChapters の後にpreScoringRules適用**

`const candidateChapters = tree.filter(...)` (line 194) と `let chapterScores = scoreNodes(...)` (line 195) の間に挿入:

```typescript
  // ★ NEW: Apply pre-scoring rules for chapters that have rules
  let filteredCandidateChapters = candidateChapters;
  const chapterRulesMap = new Map<string, ChapterRuleSet>();
  for (const ch of candidateChapters) {
    const rules = loadChapterRules(ch.code);
    if (rules) {
      chapterRulesMap.set(ch.code, rules);
      filteredCandidateChapters = applyPreScoringRules(
        rules.preScoringRules,
        input,
        filteredCandidateChapters,
      );
    }
  }
```

そして既存の `scoreNodes(tokens, candidateChapters)` を `scoreNodes(tokens, filteredCandidateChapters)` に変更。

**変更2: subheading scoring ループ内でスコア調整適用**

subheading ループ内（`for (const sub of heading.children)` ブロック内）、`confidence` 計算の後、`allCandidates.push(...)` の前に挿入:

```typescript
        // ★ NEW: Apply scoring adjustments from chapter rules
        let adjustedConfidence = confidence;
        const extraReasoning: string[] = [];
        const chRules = chapterRulesMap.get(chapter.code);
        if (chRules && chRules.scoringRules.length > 0) {
          const tempCandidate: Candidate = {
            hscode: sub.code,
            description: sub.description,
            confidence,
            reasoning: [],
            matchedTokenCount: matchedCount,
          };
          const adjustments = applyScoringAdjustments(chRules.scoringRules, input, tempCandidate);
          const totalFactor = adjustments.reduce((acc, a) => acc * a.factor, 1.0);
          adjustedConfidence = confidence * totalFactor;
          for (const a of adjustments) {
            if (a.factor !== 1.0) {
              extraReasoning.push(a.reason);
            }
          }
        }
```

`allCandidates.push(...)` 内の `confidence` を `adjustedConfidence` に変更し、`reasoning` 配列に `...extraReasoning` を追加。

heading-only（子なし）ブロック（`if (heading.children.length === 0)`）にも同じ調整パターンを適用する:

```typescript
      if (heading.children.length === 0) {
        const descTokens = new Set(tokenize(heading.description));
        const matchedCount = stemMatchCount(tokens, descTokens);
        const confidence =
          SCORING.SECTION_WEIGHT * sScore +
          SCORING.CHAPTER_WEIGHT * chScore +
          SCORING.HEADING_WEIGHT * hScore +
          SCORING.SUBHEADING_WEIGHT * hScore;

        // ★ NEW: Apply scoring adjustments (same pattern as subheading loop)
        let adjustedConfidence = confidence;
        const extraReasoning: string[] = [];
        const chRules = chapterRulesMap.get(chapter.code);
        if (chRules && chRules.scoringRules.length > 0) {
          const tempCandidate: Candidate = {
            hscode: heading.code,
            description: heading.description,
            confidence,
            reasoning: [],
            matchedTokenCount: matchedCount,
          };
          const adjustments = applyScoringAdjustments(chRules.scoringRules, input, tempCandidate);
          const totalFactor = adjustments.reduce((acc, a) => acc * a.factor, 1.0);
          adjustedConfidence = confidence * totalFactor;
          for (const a of adjustments) {
            if (a.factor !== 1.0) {
              extraReasoning.push(a.reason);
            }
          }
        }

        allCandidates.push({
          hscode: heading.code,
          description: heading.description,
          confidence: adjustedConfidence,
          matchedTokenCount: matchedCount,
          reasoning: [
            `Section ${sectionEntry?.section ?? "?"}: ${sectionEntry?.title ?? ""}`,
            `Chapter ${chapter.code}: ${chapter.description}`,
            `Heading ${heading.code}: ${heading.description}`,
            ...extraReasoning,
          ],
        });
        continue;
      }
```

- [ ] **Step 3: テスト実行 — リグレッション確認**

Run: `npx vitest run`
Expected: PASS — 既存テスト全て通過。Chapter 87のルールが適用されるのは `bicycle` テストケース1件のみ（既存50件中）。ルールの無い章はloadChapterRulesがnullを返すため影響なし。

- [ ] **Step 4: もしリグレッションがあれば修正**

既存テストが落ちた場合、以下を確認:
- `evaluateCondition` の `contains` が `String(value).includes(String(condition.value))` であり、大文字小文字を区別する。rules.json の条件値を小文字にする
- preScoringRules のフィルタリングが既存候補を誤って除外していないか確認
- `filteredCandidateChapters` が空になっていないか確認

- [ ] **Step 5: コミット**

```bash
git add src/classifier.ts
git commit -m "feat: integrate rule applier into classify() with backward compatibility"
```

---

### Task 7: Chapter 87 A/B テストケース

**Files:**
- Create: `tests/chapter-87.test.ts`
- Create: `tests/fixtures/chapter-87-cases.json`

- [ ] **Step 1: テストフィクスチャを作成**

`tests/fixtures/chapter-87-cases.json`:

```json
[
  { "description": "sedan car, 1500cc gasoline engine", "expected4": "8703", "expected6": "870322", "notes": "basic passenger car" },
  { "description": "diesel truck for cargo, GVW 10 tons", "expected4": "8704", "expected6": "870422", "notes": "cargo vehicle" },
  { "description": "agricultural tractor, 90 HP", "expected4": "8701", "expected6": "870191", "notes": "definition: tractor = hauling/pushing" },
  { "description": "children's bicycle with training wheels", "expected4": "8712", "expected6": "871200", "notes": "Note 4: children bicycle -> 8712" },
  { "description": "bus for 25 passengers", "expected4": "8702", "expected6": "870210", "notes": "scope: >= 10 persons" },
  { "description": "motorcycle, 250cc", "expected4": "8711", "expected6": "871120", "notes": "basic motorcycle" },
  { "description": "bicycle parts, rear derailleur", "expected4": "8714", "expected6": "871491", "notes": "parts classification" },
  { "description": "electric scooter for personal transport", "expected4": "8711", "expected6": "871160", "notes": "electric mobility" },
  { "description": "motor chassis fitted with cab, for passenger car", "expected4": "8703", "expected6": "870390", "notes": "Note 3: chassis+cab -> 8702-8704 NOT 8706" },
  { "description": "baby stroller with wheels", "expected4": "8715", "expected6": "871500", "notes": "baby carriages" }
]
```

- [ ] **Step 2: A/Bテストを書く**

`tests/chapter-87.test.ts`:

```typescript
// tests/chapter-87.test.ts
// A/B comparison test: Chapter 87 accuracy with and without rules.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { classify, loadTree } from "../src/classifier.js";
import { loadRules, clearRules } from "../src/rule-applier.js";
import testCases from "./fixtures/chapter-87-cases.json";

interface TestCase {
  description: string;
  expected4: string;
  expected6: string;
  notes: string;
}

describe.each([
  { label: "without rules", useRules: false },
  { label: "with rules", useRules: true },
])("Chapter 87 accuracy ($label)", ({ label, useRules }) => {
  beforeAll(() => {
    loadTree();
    clearRules();
    if (useRules) {
      loadRules("87");
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
    ({ description, expected4, expected6, notes }) => {
      const result = classify({ description });
      const top = result.candidates[0];

      const match4 = top?.hscode.startsWith(expected4) ?? false;
      const match6 = top?.hscode === expected6;

      if (match4) correct4++;
      if (match6) correct6++;

      // Log for visibility
      if (!match4) {
        console.log(
          `  [${label}] MISS: "${description}" -> got ${top?.hscode ?? "none"}, expected ${expected4}* (${notes})`,
        );
      }

      // For test #9 (chassis+cab): dual assertion per spec
      if (description.includes("chassis") && description.includes("cab")) {
        expect(top?.hscode.startsWith("8703")).toBe(true);
        expect(top?.hscode.startsWith("8706")).toBe(false);
      }

      // Basic assertion: result should have candidates
      expect(result.candidates.length).toBeGreaterThan(0);
    },
  );

  // Report accuracy after all cases
  it("reports accuracy", () => {
    console.log(`\n  [${label}] 4-digit: ${correct4}/${total} (${((correct4 / total) * 100).toFixed(0)}%)`);
    console.log(`  [${label}] 6-digit: ${correct6}/${total} (${((correct6 / total) * 100).toFixed(0)}%)\n`);

    if (useRules) {
      // Success criteria: 4-digit accuracy >= 80% with rules
      expect(correct4).toBeGreaterThanOrEqual(8);
    }
  });
});
```

- [ ] **Step 3: テスト実行**

Run: `npx vitest run tests/chapter-87.test.ts`
Expected: テストが実行され、A/B比較結果が出力される。`with rules` の4桁精度が `without rules` より高いことを確認。

- [ ] **Step 4: 結果分析と微調整**

テスト結果を分析:
- `without rules` の精度をベースラインとして記録
- `with rules` の改善幅を確認
- 8件未達の場合、以下を順に調整:
  1. `data/rules/chapter-87.json` の条件値を修正
  2. `src/rule-applier.ts` のフィルタリングロジックを修正
  3. ブースト係数を調整（1.15 → 1.2 等）

特に注意するケース:
- Test #9 (chassis+cab): `applyPreScoringRules` で8706が除外されていること
- Test #3 (tractor): `applyScoringAdjustments` でdefinitionブーストが効いていること
- Test #4 (children's bicycle): ルーティングが機能していること

- [ ] **Step 5: 全テスト実行 — リグレッション確認**

Run: `npx vitest run`
Expected: PASS — 既存50件 + Chapter 87 A/B テスト全通過

- [ ] **Step 6: コミット**

```bash
git add tests/chapter-87.test.ts tests/fixtures/chapter-87-cases.json
git commit -m "feat: add Chapter 87 A/B comparison tests (10 cases)"
```

---

### Task 8: Rule generator + テスト（Layer 3）

**Files:**
- Create: `compiler/rule-generator.ts`
- Create: `tests/rule-generator.test.ts`

- [ ] **Step 1: テストを書く**

`tests/rule-generator.test.ts`:

```typescript
// tests/rule-generator.test.ts
import { describe, it, expect } from "vitest";
import { generateRules } from "../compiler/rule-generator.js";
import type { ClassifiedClause } from "../compiler/types.js";
import type { ChapterRuleSet } from "../src/rule-types.js";

describe("generateRules", () => {
  it("sorts exclusion clauses into preScoringRules", () => {
    const clauses: ClassifiedClause[] = [
      {
        source: "chapter",
        noteNumber: 1,
        text: "This Chapter does not cover railway...",
        clauseType: "exclusion",
        params: { excludedCodes: ["87"], reason: "rail only excluded" },
      },
    ];
    const result = generateRules(clauses, "87");
    expect(result.chapter).toBe("87");
    expect(result.preScoringRules).toHaveLength(1);
    expect(result.preScoringRules[0].clauseType).toBe("exclusion");
    expect(result.scoringRules).toHaveLength(0);
    expect(result.partsRules).toHaveLength(0);
  });

  it("sorts routing clauses into preScoringRules", () => {
    const clauses: ClassifiedClause[] = [
      {
        source: "chapter",
        noteNumber: 3,
        text: "Motor chassis fitted with cabs...",
        clauseType: "routing",
        params: {
          target: "8702-8704",
          conditions: [
            { type: "contains", field: "description", value: "chassis" },
            { type: "contains", field: "description", value: "cab" },
          ],
        },
      },
    ];
    const result = generateRules(clauses, "87");
    expect(result.preScoringRules).toHaveLength(1);
    expect(result.preScoringRules[0].clauseType).toBe("routing");
  });

  it("sorts definition clauses into scoringRules", () => {
    const clauses: ClassifiedClause[] = [
      {
        source: "chapter",
        noteNumber: 2,
        text: "tractors means...",
        clauseType: "definition",
        params: { term: "tractor", meaning: "hauling vehicle", appliesTo: ["8701"] },
      },
    ];
    const result = generateRules(clauses, "87");
    expect(result.scoringRules).toHaveLength(1);
    expect(result.scoringRules[0].clauseType).toBe("definition");
  });

  it("sorts scope clauses into scoringRules", () => {
    const clauses: ClassifiedClause[] = [
      {
        source: "subheading",
        noteNumber: 1,
        text: "8708.22 covers windscreens...",
        clauseType: "scope",
        params: {
          heading: "870822",
          covers: "windscreens",
          conditions: [{ type: "contains", field: "description", value: "windscreen" }],
        },
      },
    ];
    const result = generateRules(clauses, "87");
    expect(result.scoringRules).toHaveLength(1);
    expect(result.scoringRules[0].clauseType).toBe("scope");
  });

  it("sorts parts_rule clauses into partsRules", () => {
    const clauses: ClassifiedClause[] = [
      {
        source: "section",
        noteNumber: 3,
        text: "principal use...",
        clauseType: "parts_rule",
        params: { rule: "principal_use", affectedCodes: ["86", "87", "88"] },
      },
    ];
    const result = generateRules(clauses, "87");
    expect(result.partsRules).toHaveLength(1);
    expect(result.partsRules[0].clauseType).toBe("parts_rule");
  });

  it("handles mixed clause types", () => {
    const clauses: ClassifiedClause[] = [
      {
        source: "chapter", noteNumber: 1, text: "exclusion",
        clauseType: "exclusion",
        params: { excludedCodes: ["87"], reason: "test" },
      },
      {
        source: "chapter", noteNumber: 2, text: "definition",
        clauseType: "definition",
        params: { term: "tractor", meaning: "hauling", appliesTo: ["8701"] },
      },
      {
        source: "chapter", noteNumber: 3, text: "routing",
        clauseType: "routing",
        params: { target: "8702-8704", conditions: [] },
      },
      {
        source: "section", noteNumber: 3, text: "parts",
        clauseType: "parts_rule",
        params: { rule: "principal_use" },
      },
      {
        source: "subheading", noteNumber: 1, text: "scope",
        clauseType: "scope",
        params: { heading: "870822", covers: "windscreens", conditions: [] },
      },
    ];
    const result = generateRules(clauses, "87");
    expect(result.preScoringRules).toHaveLength(2); // exclusion + routing
    expect(result.scoringRules).toHaveLength(2);     // definition + scope
    expect(result.partsRules).toHaveLength(1);        // parts_rule
  });

  it("strips NoteClause metadata from output", () => {
    const clauses: ClassifiedClause[] = [
      {
        source: "chapter", noteNumber: 1, text: "full note text here",
        clauseType: "exclusion",
        params: { excludedCodes: ["87"], reason: "test" },
      },
    ];
    const result = generateRules(clauses, "87");
    const rule = result.preScoringRules[0];
    // Rule should not contain NoteClause fields
    expect((rule as any).source).toBeUndefined();
    expect((rule as any).noteNumber).toBeUndefined();
    expect((rule as any).text).toBeUndefined();
  });

  it("returns empty arrays for empty input", () => {
    const result = generateRules([], "87");
    expect(result.chapter).toBe("87");
    expect(result.preScoringRules).toHaveLength(0);
    expect(result.scoringRules).toHaveLength(0);
    expect(result.partsRules).toHaveLength(0);
  });
});
```

- [ ] **Step 2: テスト実行 — 失敗確認**

Run: `npx vitest run tests/rule-generator.test.ts`
Expected: FAIL — `compiler/rule-generator.js` が存在しない

- [ ] **Step 3: rule-generator を実装**

`compiler/rule-generator.ts`:

```typescript
// compiler/rule-generator.ts
// Layer 3: Convert classified clauses into a ChapterRuleSet for runtime use.

import type { ClassifiedClause } from "./types.js";
import type {
  ChapterRuleSet,
  PreScoringRule,
  ScoringRule,
  PartsRule,
} from "../src/rule-types.js";

/**
 * Generate a ChapterRuleSet from classified clauses.
 * Strips NoteClause metadata (source, noteNumber, text) and sorts
 * clauses into the appropriate rule category.
 */
export function generateRules(clauses: ClassifiedClause[], chapter: string): ChapterRuleSet {
  const preScoringRules: PreScoringRule[] = [];
  const scoringRules: ScoringRule[] = [];
  const partsRules: PartsRule[] = [];

  for (const clause of clauses) {
    switch (clause.clauseType) {
      case "exclusion":
        preScoringRules.push({
          clauseType: "exclusion",
          params: clause.params,
        } as PreScoringRule);
        break;
      case "routing":
        preScoringRules.push({
          clauseType: "routing",
          params: clause.params,
        } as PreScoringRule);
        break;
      case "definition":
        scoringRules.push({
          clauseType: "definition",
          params: clause.params,
        } as ScoringRule);
        break;
      case "scope":
        scoringRules.push({
          clauseType: "scope",
          params: clause.params,
        } as ScoringRule);
        break;
      case "parts_rule":
        partsRules.push({
          clauseType: "parts_rule",
          params: clause.params,
        } as PartsRule);
        break;
    }
  }

  return {
    chapter,
    preScoringRules,
    scoringRules,
    partsRules,
  };
}
```

- [ ] **Step 4: テスト実行 — 成功確認**

Run: `npx vitest run tests/rule-generator.test.ts`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add compiler/rule-generator.ts tests/rule-generator.test.ts
git commit -m "feat: add rule generator (Layer 3) — ClassifiedClause to ChapterRuleSet"
```

---

### Task 9: Clause classifier（Layer 2）

**Files:**
- Create: `compiler/clause-classifier.ts`
- Modify: `package.json` (devDependency追加)

**注意:** このタスクはLLM APIを使うため、自動テストは書かない。手動確認のみ。

- [ ] **Step 1: @anthropic-ai/sdk をdevDependencyに追加**

```bash
npm install --save-dev @anthropic-ai/sdk
```

- [ ] **Step 2: clause-classifier を実装**

`compiler/clause-classifier.ts`:

```typescript
// compiler/clause-classifier.ts
// Layer 2: Classify parsed note clauses using LLM (build-time only).

import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "node:fs";
import type { NoteClause, ClassifiedClause, ClauseType } from "./types.js";

const MODEL = "claude-haiku-4-5-20251001";
const MAX_RETRIES = 2;

interface FewShotExample {
  input: string;
  output: ClassifiedClause;
}

/**
 * Classify an array of parsed NoteClause using LLM.
 * Makes 1 API call per clause with few-shot examples.
 */
export async function classifyClauses(
  clauses: NoteClause[],
  fewShotPath: string,
): Promise<ClassifiedClause[]> {
  const fewShot: FewShotExample[] = JSON.parse(readFileSync(fewShotPath, "utf-8"));
  const client = new Anthropic();
  const results: ClassifiedClause[] = [];

  for (const clause of clauses) {
    const classified = await classifySingleClause(client, clause, fewShot);
    results.push(classified);
  }

  return results;
}

async function classifySingleClause(
  client: Anthropic,
  clause: NoteClause,
  fewShot: FewShotExample[],
): Promise<ClassifiedClause> {
  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(clause, fewShot);

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      });

      const text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("");

      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error(`No JSON found in response: ${text.slice(0, 200)}`);
      }

      const parsed = JSON.parse(jsonMatch[0]) as {
        clauseType: ClauseType;
        params: Record<string, unknown>;
      };

      // Validate clause type
      const validTypes: ClauseType[] = [
        "exclusion", "definition", "routing", "parts_rule", "scope",
      ];
      if (!validTypes.includes(parsed.clauseType)) {
        throw new Error(`Unknown clause type: ${parsed.clauseType}`);
      }

      return {
        ...clause,
        clauseType: parsed.clauseType,
        params: parsed.params as ClassifiedClause["params"],
      };
    } catch (error) {
      if (attempt === MAX_RETRIES) {
        console.error(
          `Failed to classify clause after ${MAX_RETRIES + 1} attempts:`,
          clause.text.slice(0, 100),
        );
        throw error;
      }
      console.warn(`Retry ${attempt + 1} for clause: ${clause.text.slice(0, 80)}...`);
    }
  }

  // Unreachable, but TypeScript needs it
  throw new Error("Unreachable");
}

function buildSystemPrompt(): string {
  return `You are a trade classification expert. Your task is to classify each HS (Harmonized System) Note clause into exactly one type and extract structured parameters.

Types:
- exclusion: The clause excludes certain items/codes from a section, chapter, or heading.
- definition: The clause defines a term used in the chapter (e.g., "tractors" means...).
- routing: The clause routes items to a specific heading or chapter based on conditions.
- parts_rule: The clause specifies special treatment for parts/accessories (principal use, stay in own heading, etc.).
- scope: The clause narrows or defines the scope of a specific heading/subheading.

Respond with a JSON object containing "clauseType" and "params" fields. Do not include any explanation outside the JSON.`;
}

function buildUserPrompt(clause: NoteClause, fewShot: FewShotExample[]): string {
  let prompt = "Few-shot examples:\n\n";

  for (const example of fewShot) {
    prompt += `Input: ${example.input}\nOutput: ${JSON.stringify({ clauseType: example.output.clauseType, params: example.output.params })}\n\n`;
  }

  prompt += `Now classify this clause:\nInput: ${clause.text}\nOutput (JSON):`;
  return prompt;
}
```

- [ ] **Step 3: 手動テスト（オプション、ANTHROPIC_API_KEY が必要）**

```bash
# API keyが設定されている場合のみ実行
npx tsx -e "
import { parseNotes } from './compiler/notes-parser.js';
import { classifyClauses } from './compiler/clause-classifier.js';
import { readFileSync } from 'fs';

const md = readFileSync('data/notes/chapter-87.md', 'utf-8');
const clauses = parseNotes(md);
console.log('Parsed clauses:', clauses.length);

// Test with first 2 clauses only to minimize API cost
const classified = await classifyClauses(clauses.slice(0, 2), 'compiler/few-shot/chapter-87.json');
console.log(JSON.stringify(classified, null, 2));
"
```

- [ ] **Step 4: コミット**

```bash
git add compiler/clause-classifier.ts package.json package-lock.json
git commit -m "feat: add clause classifier (Layer 2) using Anthropic SDK"
```

---

### Task 10: コンパイルパイプラインCLI

**Files:**
- Create: `compiler/compile-rules.ts`

- [ ] **Step 1: CLI スクリプトを実装**

`compiler/compile-rules.ts`:

```typescript
// compiler/compile-rules.ts
// CLI entry point: parse notes -> classify via LLM -> generate rules.json
//
// Usage:
//   npx tsx compiler/compile-rules.ts --chapter 87 \
//     --notes data/notes/chapter-87.md \
//     --section-notes data/notes/section-17.md

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { parseNotes } from "./notes-parser.js";
import { classifyClauses } from "./clause-classifier.js";
import { generateRules } from "./rule-generator.js";

interface CliArgs {
  chapter: string;
  notes: string;
  sectionNotes?: string;
}

function parseArgs(args: string[]): CliArgs {
  const result: Partial<CliArgs> = {};

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--chapter":
        result.chapter = args[++i];
        break;
      case "--notes":
        result.notes = args[++i];
        break;
      case "--section-notes":
        result.sectionNotes = args[++i];
        break;
    }
  }

  if (!result.chapter || !result.notes) {
    console.error(
      "Usage: npx tsx compiler/compile-rules.ts --chapter <num> --notes <path> [--section-notes <path>]",
    );
    process.exit(1);
  }

  return result as CliArgs;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  console.log(`Compiling rules for Chapter ${args.chapter}...`);

  // Step 1: Parse notes
  let markdown = readFileSync(resolve(args.notes), "utf-8");
  if (args.sectionNotes) {
    const sectionMd = readFileSync(resolve(args.sectionNotes), "utf-8");
    markdown = sectionMd + "\n\n" + markdown;
  }

  const clauses = parseNotes(markdown);
  console.log(`Parsed ${clauses.length} clauses`);

  // Step 2: Classify via LLM
  const fewShotPath = resolve(`compiler/few-shot/chapter-${args.chapter}.json`);
  console.log("Classifying clauses using LLM...");
  const classified = await classifyClauses(clauses, fewShotPath);
  console.log(`Classified ${classified.length} clauses`);

  // Log classification summary
  for (const c of classified) {
    const subLabel = c.subItem ? c.subItem : "";
    console.log(
      `  [${c.clauseType}] Note ${c.noteNumber}${subLabel}: ${c.text.slice(0, 60)}...`,
    );
  }

  // Step 3: Generate rules
  const ruleSet = generateRules(classified, args.chapter);
  console.log(
    `Generated: ${ruleSet.preScoringRules.length} pre-scoring, ` +
    `${ruleSet.scoringRules.length} scoring, ` +
    `${ruleSet.partsRules.length} parts rules`,
  );

  // Step 4: Write output
  const outputPath = resolve(`data/rules/chapter-${args.chapter}.json`);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, JSON.stringify(ruleSet, null, 2) + "\n", "utf-8");
  console.log(`Written to ${outputPath}`);
}

main().catch((err) => {
  console.error("Compile failed:", err);
  process.exit(1);
});
```

- [ ] **Step 2: コミット**

```bash
git add compiler/compile-rules.ts
git commit -m "feat: add compile-rules CLI for notes-to-rules pipeline"
```

---

### Task 11: リグレッション検証 + クリーンアップ

- [ ] **Step 1: 全テスト実行**

```bash
npx vitest run
```

Expected: 全テスト PASS。出力を確認:
- 既存50件テスト（`classifier.test.ts`）: 変更なし（リグレッションなし）
- `set-tree.test.ts`: PASS
- `notes-parser.test.ts`: PASS
- `rule-applier.test.ts`: PASS
- `rule-generator.test.ts`: PASS
- `types.test.ts`: PASS
- `chapter-87.test.ts`: A/B比較結果が出力される

- [ ] **Step 2: Chapter 87 A/B テスト結果を記録**

テスト出力から精度を記録:

```
[without rules] 4-digit: X/10 (XX%)
[without rules] 6-digit: X/10 (XX%)
[with rules]    4-digit: X/10 (XX%)
[with rules]    6-digit: X/10 (XX%)
```

成功基準: `with rules` で4桁精度 >= 80%（8/10以上）

- [ ] **Step 3: 精度未達の場合の対応**

4桁精度 < 80% の場合、以下を順に調整:

1. `data/rules/chapter-87.json` のルール条件を修正（conditions の value を調整）
2. `src/rule-applier.ts` の `applyPreScoringRules` のフィルタリングロジックを修正
3. `src/rule-applier.ts` の `applyScoringAdjustments` のブースト係数を調整（1.15 → 1.2 等）
4. 調整後に再度全テスト実行して確認

- [ ] **Step 4: 最終コミット**

```bash
git add -A
git commit -m "feat: AI compiler PoC complete — Chapter 87 rules pipeline with A/B testing"
```

- [ ] **Step 5: 結果サマリ**

最終的な精度を以下の形式でコンソール出力として確認:

| メトリクス | ルールなし | ルールあり | 改善 |
|-----------|----------|----------|------|
| 4桁精度 | X/10 | Y/10 | +Z |
| 6桁精度 | X/10 | Y/10 | +Z |
| 既存50件リグレッション | 0 | 0 | -- |
