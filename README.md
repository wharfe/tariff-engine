# tariff-engine

Rule-based HS (Harmonized System) code classification engine.

**[Try the live demo →](https://tariff-engine.vercel.app)**

Given a product description, returns 6-digit HS code candidates with **confidence scores** and **full reasoning paths**. No runtime AI — offline-capable, deterministic, sub-100ms.

## Why

Every existing HS classification tool (Zonos, Digicust, Tariffnumber, etc.) runs ML/LLM inference on every request. That means:

- Per-request inference cost
- No offline capability
- Black-box results (no explanation of *why* a code was chosen)
- High latency

**tariff-engine** uses AI only at build time to compile a rule tree. At runtime, it traverses the tree deterministically:

- **Zero inference cost** — no AI at runtime
- **Works offline** — no network calls
- **Explainable** — outputs the full decision path: Section → Chapter → Heading → Subheading
- **Fast** — ~57ms per classification

## Install

```bash
npm install tariff-engine
```

## Usage

### CLI

```bash
npx tariff-engine classify "lithium-ion battery for mobile phone"
```

```
850760 (65%) - Lithium-ion accumulators
  → Section XVI: Machinery and mechanical appliances; electrical equipment...
  → Chapter 85: Electrical machinery and equipment and parts thereof...
  → Heading 8507: Electric accumulators, including separators therefor...
  → Subheading 850760: Lithium-ion accumulators

⚠ Low confidence — manual review recommended.
```

### Library

```typescript
import { classify, loadTree } from "tariff-engine";

// Load the HS tree (once)
loadTree();

// Classify
const result = classify({ description: "stainless steel kitchen knife" });

for (const candidate of result.candidates) {
  console.log(`${candidate.hscode} (${(candidate.confidence * 100).toFixed(0)}%)`);
  console.log(`  ${candidate.description}`);
  for (const reason of candidate.reasoning) {
    console.log(`  → ${reason}`);
  }
}

if (result.needs_review) {
  console.log("Low confidence — manual review recommended");
}
```

### Types

```typescript
interface ClassifyInput {
  description: string;
  attributes?: {
    material?: string;
    weight_kg?: number;
    dimensions_cm?: { l: number; w: number; h: number };
    use?: string;
  };
}

interface ClassifyResult {
  candidates: Candidate[];
  needs_review: boolean;  // true when confidence < 0.6
}

interface Candidate {
  hscode: string;         // 6-digit HS code (e.g. "940161")
  description: string;    // Official HS description
  confidence: number;     // 0.0 - 1.0
  reasoning: string[];    // Decision path from Section to Subheading
  matchedTokenCount: number;
}
```

## Accuracy

Measured against 50 manually verified test cases (28 easy + 22 hard):

| Level | Accuracy | Target |
|-------|----------|--------|
| 4-digit (Heading) | 80% (40/50) | ≥70% ✅ |
| 6-digit (Subheading) | 50% (25/50) | ≥50% ✅ |

**Performance**: ~57ms per classification (target < 100ms ✅)

> Phase 1 uses keyword matching only. Accuracy will improve significantly in Phase 2 when Section/Chapter Notes are compiled into the rule tree via AI.

## How it works

```
[AI Compiler (build-time)]              [Rule Engine (runtime)]

  WCO Nomenclature PDF                  Product description
  + Section/Chapter Notes       →       ↓
  + Classification Opinions             Rule Tree (JSON)
                                        ↓
  Output: rules.json                    HS code + confidence + reasoning path
```

### Classification algorithm

1. **Tokenize** — normalize product description, apply stemming
2. **Section match** — score 21 HS sections by keyword overlap
3. **Chapter match** — score chapters within top sections
4. **Heading match** — GIR 1 (terms of the headings) matching
5. **Subheading match** — GIR 6 based final classification
6. **Confidence scoring** — weighted blend of multiple signals

### Zero runtime dependencies

Uses Node.js standard library only. No external packages at runtime.

## Data sources

- [UN Comtrade HS Dataset](https://github.com/datasets/harmonized-system) — CSV, Public Domain
- [Japan Customs Tariff Schedule](https://www.customs.go.jp/english/tariff/) — HTML, Public
- [WCO HS Nomenclature 2022](https://www.wcoomd.org/) — Section/Chapter Notes

## Roadmap

- [x] Phase 1: Keyword-based classification (MVP)
- [ ] Phase 2: AI compiler (Section/Chapter Notes → rules.json)
- [ ] Country-specific extensions (7-10 digit codes)
- [ ] Structured attribute integration (material, weight, dimensions)

## Development

```bash
git clone https://github.com/wharfe/tariff-engine.git
cd tariff-engine
npm install
npm test          # 112 tests
npm run build     # builds to dist/
npx tsx cli/index.ts classify "cotton t-shirt"
```

## License

MIT
