# プロジェクト初期化 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** tariff-engineプロジェクトのTypeScript開発環境をゼロから構築し、ビルド・テスト・CLIが動作する状態にする

**Architecture:** TypeScript + ES Modules、vitest でテスト、tsup でビルド。ランタイム依存なし。src/ にコアライブラリ、cli/ にCLIラッパー、compiler/ にビルド時パイプライン、tests/ にテスト。

**Tech Stack:** TypeScript, Node.js, vitest, tsup, tsx

---

## ファイル構成

```
tariff-engine/
├── .gitignore
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── src/
│   ├── types.ts              # Shared types (ClassifyInput, ClassifyResult, etc.)
│   ├── tokenizer.ts          # Product description → normalized tokens
│   ├── rule-engine.ts        # Evaluates rules against token set
│   ├── gir.ts                # General Interpretive Rules 1-6
│   └── classifier.ts         # Main entry: description → HS code candidates
├── cli/
│   └── index.ts              # CLI wrapper
├── compiler/
│   └── parse-nomenclature.ts # Parse UN Comtrade CSV → hs-tree.json
├── data/                     # (gitignored JSON data, generated at build time)
│   └── .gitkeep
└── tests/
    └── types.test.ts         # Initial test to verify setup
```

---

### Task 1: package.json + .gitignore

**Files:**
- Create: `package.json`
- Create: `.gitignore`

- [ ] **Step 1: Create package.json**

```bash
cd /home/feathach/dev/tariff-engine
npm init -y
```

Then update package.json to:

```json
{
  "name": "tariff-engine",
  "version": "0.1.0",
  "description": "Rule-based HS code classification engine",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsup",
    "test": "vitest run",
    "test:watch": "vitest",
    "classify": "tsx cli/index.ts"
  },
  "keywords": ["hs-code", "tariff", "classification", "harmonized-system"],
  "license": "MIT",
  "engines": {
    "node": ">=18"
  }
}
```

- [ ] **Step 2: Create .gitignore**

```
node_modules/
dist/
*.tsbuildinfo
data/*.json
!data/.gitkeep
.env
```

- [ ] **Step 3: Commit**

```bash
git add package.json .gitignore
git commit -m "chore: initialize package.json and .gitignore"
```

---

### Task 2: TypeScript + tooling setup

**Files:**
- Create: `tsconfig.json`
- Create: `tsup.config.ts`

- [ ] **Step 1: Install dev dependencies**

```bash
npm install -D typescript vitest tsup tsx @types/node
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": ".",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "lib": ["ES2022"]
  },
  "include": ["src/**/*.ts", "cli/**/*.ts", "compiler/**/*.ts"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 3: Create tsup.config.ts**

```typescript
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
});
```

- [ ] **Step 4: Commit**

```bash
git add tsconfig.json tsup.config.ts package-lock.json
git commit -m "chore: add TypeScript, vitest, tsup configuration"
```

---

### Task 3: Shared types

**Files:**
- Create: `src/types.ts`
- Create: `tests/types.test.ts`

- [ ] **Step 1: Write the test**

```typescript
// tests/types.test.ts
import { describe, it, expect } from "vitest";
import type {
  ClassifyInput,
  ClassifyResult,
  Candidate,
  HsNode,
  RuleCondition,
} from "../src/types.js";

describe("types", () => {
  it("ClassifyInput accepts description only", () => {
    const input: ClassifyInput = { description: "wooden chair" };
    expect(input.description).toBe("wooden chair");
    expect(input.attributes).toBeUndefined();
  });

  it("ClassifyInput accepts description with attributes", () => {
    const input: ClassifyInput = {
      description: "wooden chair",
      attributes: { material: "wood", weight_kg: 5.2 },
    };
    expect(input.attributes?.material).toBe("wood");
  });

  it("ClassifyResult has candidates and needs_review", () => {
    const result: ClassifyResult = {
      candidates: [
        {
          hscode: "940360",
          description: "Other wooden furniture",
          confidence: 0.85,
          reasoning: ["Chapter 94", "Heading 9403", "Subheading 940360"],
        },
      ],
      needs_review: false,
    };
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].hscode).toBe("940360");
    expect(result.needs_review).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/types.test.ts
```

Expected: FAIL (cannot resolve `../src/types.js`)

- [ ] **Step 3: Create src/types.ts**

```typescript
// src/types.ts

export interface ClassifyInput {
  description: string;
  attributes?: {
    material?: string;
    weight_kg?: number;
    dimensions_cm?: { l: number; w: number; h: number };
    use?: string;
  };
}

export interface Candidate {
  hscode: string;
  description: string;
  confidence: number;
  reasoning: string[];
}

export interface ClassifyResult {
  candidates: Candidate[];
  needs_review: boolean;
}

export interface HsNode {
  code: string;
  description: string;
  level: number;
  parent?: string;
  children: HsNode[];
}

export interface RuleCondition {
  type: "equals" | "contains" | "gt" | "lt" | "gte" | "lte" | "not_contains";
  field: string;
  value: string | number;
}

export interface HeadingRule {
  description: string;
  exclusions: string[];
  subheadings: Record<
    string,
    {
      description: string;
      conditions: RuleCondition[];
    }
  >;
}

export interface ChapterRules {
  chapter: string;
  notes: {
    type: "exclusion" | "inclusion" | "definition";
    condition: string;
    action: string;
  }[];
  headings: Record<string, HeadingRule>;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/types.test.ts
```

Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/types.ts tests/types.test.ts
git commit -m "feat: add shared types for classification engine"
```

---

### Task 4: Stub modules + src/index.ts + build verification

**Files:**
- Create: `src/tokenizer.ts`
- Create: `src/rule-engine.ts`
- Create: `src/gir.ts`
- Create: `src/classifier.ts`
- Create: `src/index.ts`
- Create: `cli/index.ts`
- Create: `compiler/parse-nomenclature.ts`
- Create: `data/.gitkeep`

- [ ] **Step 1: Create src/tokenizer.ts**

```typescript
// src/tokenizer.ts

const STOP_WORDS = new Set([
  "a", "an", "the", "of", "for", "and", "or", "in", "on", "to",
  "with", "by", "is", "are", "was", "were", "be", "been", "being",
  "that", "this", "it", "its", "from", "as", "at", "not", "no",
]);

export function tokenize(description: string): string[] {
  return description
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 1 && !STOP_WORDS.has(word));
}
```

- [ ] **Step 2: Create src/rule-engine.ts**

```typescript
// src/rule-engine.ts

import type { RuleCondition } from "./types.js";

export function evaluateCondition(
  condition: RuleCondition,
  attributes: Record<string, string | number | undefined>,
): boolean {
  const value = attributes[condition.field];
  if (value === undefined) return false;

  switch (condition.type) {
    case "equals":
      return value === condition.value;
    case "contains":
      return String(value).includes(String(condition.value));
    case "not_contains":
      return !String(value).includes(String(condition.value));
    case "gt":
      return Number(value) > Number(condition.value);
    case "lt":
      return Number(value) < Number(condition.value);
    case "gte":
      return Number(value) >= Number(condition.value);
    case "lte":
      return Number(value) <= Number(condition.value);
  }
}
```

- [ ] **Step 3: Create src/gir.ts**

```typescript
// src/gir.ts

import type { Candidate } from "./types.js";

/**
 * GIR 3(a): Most specific description wins.
 * Among equally matched candidates, prefer the one with more matching conditions.
 */
export function applyGir3a(candidates: Candidate[]): Candidate[] {
  return candidates.sort((a, b) => b.confidence - a.confidence);
}

/**
 * GIR 3(c): When 3(a) and 3(b) cannot resolve, take the last heading in numerical order.
 */
export function applyGir3c(candidates: Candidate[]): Candidate[] {
  if (candidates.length < 2) return candidates;
  const topConfidence = candidates[0].confidence;
  const tied = candidates.filter((c) => c.confidence === topConfidence);
  if (tied.length <= 1) return candidates;
  tied.sort((a, b) => b.hscode.localeCompare(a.hscode));
  return [tied[0], ...candidates.filter((c) => c.confidence !== topConfidence)];
}
```

- [ ] **Step 4: Create src/classifier.ts**

```typescript
// src/classifier.ts

import type { ClassifyInput, ClassifyResult } from "./types.js";

export function classify(input: ClassifyInput): ClassifyResult {
  // Phase 1 implementation will be built incrementally
  // For now, return empty result to validate the pipeline
  return {
    candidates: [],
    needs_review: true,
  };
}
```

- [ ] **Step 5: Create src/index.ts**

```typescript
// src/index.ts

export { classify } from "./classifier.js";
export { tokenize } from "./tokenizer.js";
export { evaluateCondition } from "./rule-engine.js";
export { applyGir3a, applyGir3c } from "./gir.js";
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

- [ ] **Step 6: Create cli/index.ts**

```typescript
// cli/index.ts

import { classify } from "../src/index.js";

const args = process.argv.slice(2);
const command = args[0];

if (command === "classify" && args[1]) {
  const result = classify({ description: args[1] });
  if (result.candidates.length === 0) {
    console.log("No candidates found. Rule data may not be loaded yet.");
  } else {
    for (const c of result.candidates) {
      console.log(`${c.hscode} (${(c.confidence * 100).toFixed(0)}%) - ${c.description}`);
      for (const r of c.reasoning) {
        console.log(`  → ${r}`);
      }
    }
  }
  if (result.needs_review) {
    console.log("\n⚠ Low confidence — manual review recommended.");
  }
} else {
  console.log("Usage: tariff-engine classify <description>");
  console.log('Example: tariff-engine classify "wooden dining table"');
}
```

- [ ] **Step 7: Create compiler/parse-nomenclature.ts (stub)**

```typescript
// compiler/parse-nomenclature.ts

/**
 * Parses UN Comtrade CSV into hs-tree.json.
 * Input: data/raw/harmonized-system.csv
 * Output: data/hs-tree.json
 */

console.log("parse-nomenclature: not yet implemented");
console.log("Run: git clone https://github.com/datasets/harmonized-system.git data/raw");
```

- [ ] **Step 8: Create data/.gitkeep**

```bash
mkdir -p data && touch data/.gitkeep
```

- [ ] **Step 9: Verify build**

```bash
npm run build
```

Expected: tsup compiles successfully, `dist/` directory created

- [ ] **Step 10: Verify CLI runs**

```bash
npx tsx cli/index.ts classify "wooden chair"
```

Expected: "No candidates found. Rule data may not be loaded yet."

- [ ] **Step 11: Verify all tests pass**

```bash
npm test
```

Expected: All tests pass

- [ ] **Step 12: Commit**

```bash
git add src/ cli/ compiler/ data/.gitkeep tsup.config.ts
git commit -m "feat: add core module stubs, CLI, and build pipeline"
```

---

### Task 5: Push to remote

- [ ] **Step 1: Push all commits**

```bash
git push origin main
```
