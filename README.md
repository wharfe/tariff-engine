# tariff-engine

Rule-based HS (Harmonized System) code classification engine — AI at build time, deterministic at runtime.

**[Try the live demo →](https://tariff-engine.vercel.app)**

Given a product description, returns 6-digit HS code candidates with **confidence scores** and **full reasoning paths**. No runtime AI — offline-capable, deterministic, sub-100ms.

## Why

Every existing HS classification tool (Zonos, Digicust, Tariffnumber, etc.) runs ML/LLM inference on every request. That means:

- Per-request inference cost
- No offline capability
- Black-box results (no explanation of *why* a code was chosen)
- High latency

**tariff-engine** inverts this: AI runs only at build time to compile WCO Section/Chapter Notes into a deterministic rule tree. At runtime, it traverses the tree with zero inference:

- **Zero inference cost** — no AI at runtime
- **Works offline** — no network calls
- **Explainable** — outputs the full decision path: Section → Chapter → Heading → Subheading
- **Fast** — <100ms per classification

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

### Browser

```typescript
import { classify, setTree } from "tariff-engine";

// Inject HS tree directly (no filesystem needed)
const tree = await fetch("/hs-tree.json").then(r => r.json());
setTree(tree);

const result = classify({ description: "cotton t-shirt" });
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

20 chapters covered with AI-compiled rules across 13 HS Sections. Measured against 144 manually curated test cases:

| Metric | Score |
|--------|-------|
| Chapter-level (2-digit) | 76% |
| Top-3 candidates contain correct heading (4-digit) | 69% |
| Top-1 heading accuracy (4-digit) | 59% |
| Classification speed | <100ms |

**Covered categories**: apparel, electronics, machinery, plastics, rubber, furniture, toys, footwear, jewelry, ceramics, pharmaceuticals, cosmetics, leather goods, paper, wood, iron/steel articles.

> These numbers reflect a keyword-based scoring engine with LLM-compiled rules. The architecture is designed for iterative improvement — each release expands chapter coverage and rule precision.

## How it works

```
[AI Compiler (build-time)]              [Rule Engine (runtime)]

  WCO Section/Chapter Notes              Product description
         ↓                                      ↓
  LLM classifies clauses               Tokenize + stem
  into 5 rule types                     Score sections/chapters/headings
         ↓                             Apply compiled rules
  Output: rules.json                    Heading synonym boost
  + heading-synonyms.json                      ↓
                                        HS code + confidence + reasoning
```

### AI compiler pipeline

The build-time compiler converts WCO legal text into deterministic rules:

1. **Notes Parser** — Markdown → structured clauses (regex, deterministic)
2. **Clause Classifier** — Clause → rule type via LLM (Claude Haiku, build-time only)
3. **Rule Generator** — Classified clauses → JSON rule set (deterministic)

Five rule types: `exclusion`, `definition`, `routing`, `parts_rule`, `scope`

### Classification algorithm

1. **Tokenize** — normalize product description, apply stemming + synonym expansion
2. **Section match** — score 21 HS sections by keyword overlap + function-word routing
3. **Chapter match** — score chapters with product routing + context modifier suppression
4. **Heading match** — GIR 1 matching + heading synonym boost (LLM-generated everyday words)
5. **Subheading match** — GIR 6 + other-than/fallback/negation penalties
6. **Rule application** — AI-compiled exclusion, definition, scope adjustments
7. **Confidence scoring** — weighted blend of section/chapter/heading/subheading signals

### Zero runtime dependencies

Uses Node.js standard library only. No external packages at runtime.

## Data sources

- [UN Comtrade HS Dataset](https://github.com/datasets/harmonized-system) — CSV, Public Domain
- [WCO HS Nomenclature 2022](https://www.wcoomd.org/) — Section/Chapter Notes (Public text)
- [Japan Customs Tariff Schedule](https://www.customs.go.jp/english/tariff/) — HTML, Public

## Roadmap

- [x] Phase 1: Keyword-based classification (v0.1.0)
- [x] Phase 2: AI compiler — Section/Chapter Notes → rules.json (v0.2.0–v0.3.0)
- [ ] Phase 3: Priority rule type (material vs. finished product resolution)
- [ ] Phase 4: Heading-level semantic matching (build-time embeddings)
- [ ] Country-specific extensions (7-10 digit codes)
- [ ] HS 2027 migration

## Development

```bash
git clone https://github.com/wharfe/tariff-engine.git
cd tariff-engine
npm install
npm test          # 461 tests
npm run build     # builds to dist/

# Classify
npx tsx cli/index.ts classify "cotton t-shirt"

# Compile rules for a chapter
npx tsx compiler/compile-rules.ts --chapter 87 \
  --notes data/notes/chapter-87.md \
  --section-notes data/notes/section-17.md

# Generate heading synonyms
npx tsx compiler/build-heading-synonyms.ts
```

## License

MIT
