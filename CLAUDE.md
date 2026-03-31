# tariff-engine

HS（Harmonized System）コード分類のためのルールベースエンジン。
AIをビルド時に使用してルールツリーをコンパイルし、ランタイムでは決定論的に分類を実行する。

## Tech Stack

- **Language**: TypeScript (Node.js)
- **Test**: vitest
- **Build**: tsup
- **Runtime dependencies**: なし（Node.js stdlibのみ）

## Commands

```bash
# Install dependencies
npm install

# Build
npm run build

# Test
npm test

# Run single test
npx vitest run <test-file>

# CLI
npx tsx cli/index.ts classify "product description"

# Compile HS tree from UN Comtrade CSV
npx tsx compiler/parse-nomenclature.ts
```

## Architecture

```
data/           # HS tree JSON + compiled rules JSON
src/            # Core library (classifier, tokenizer, rule-engine, GIR, types)
cli/            # CLI wrapper
compiler/       # Build-time AI pipeline (parse CSV, extract notes, compile rules)
tests/          # vitest tests
```

### Design Principles

- **Zero runtime AI**: All ML/LLM usage is at build time only. Runtime classification is deterministic
- **No runtime dependencies**: Node.js stdlib only. Critical for offline/lightweight deployment
- **Explainability**: Every classification result must include the full reasoning path (Section → Chapter → Heading → Subheading with applied rules)
- **Performance**: <100ms per classification, no network calls

### Key Types

- `ClassifyInput`: Product description + optional structured attributes (material, weight, dimensions, use)
- `ClassifyResult`: Candidates array with HS code, confidence score, and reasoning path

### Classification Algorithm

1. Tokenize → 2. Section match → 3. Chapter match → 4. Heading match (GIR 1) → 5. Subheading match (GIR 6) → 6. Conflict resolution (GIR 2-5) → 7. Return sorted candidates

## Code Style

- ES Modules (import/export)
- Strict TypeScript (`strict: true`)
- Code comments in English
- 2-space indentation
- Named exports preferred over default exports

## Data Sources

- **UN Comtrade HS Dataset**: `github.com/datasets/harmonized-system` (CSV, Public Domain)
- **Japan Customs Tariff Schedule**: `customs.go.jp/english/tariff/` (HTML, Public)
- **WCO HS Nomenclature 2022**: Section/Chapter Notes (PDF, Public text)

## Phase 1 Scope (MVP)

In scope:
- Parse UN Comtrade CSV → hs-tree.json
- Keyword-based section/chapter/heading matching
- Subheading condition evaluation (keyword, exclusion, fallback, numeric threshold)
- CLI tool with top 3 candidates + confidence + reasoning
- 50 test cases: >=70% accuracy at 4-digit, >=50% at 6-digit

Out of scope: AI compiler, country-specific codes, duty rates, API/UI/apps, image classification, multi-language
