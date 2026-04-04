# Changelog

## [0.3.1] - 2026-04-04

### Changed
- Updated README with v0.3.0 features, accuracy metrics, browser usage, and AI compiler documentation
- Added heading-level synonym table (LLM-generated, 390 headings) for improved heading selection
- Top-3 accuracy: 69%, Top-1: 59%, Chapter: 76%

## [0.3.0] - 2026-04-03

### Added
- **20 chapters with AI-compiled rules** — expanded from 1 chapter (87) to 20 chapters across 13 HS Sections, covering major e-commerce product categories
  - Section VI: Ch.30 (pharma), Ch.33 (cosmetics)
  - Section VII: Ch.39 (plastics), Ch.40 (rubber)
  - Section VIII: Ch.42 (leather/bags)
  - Section IX: Ch.44 (wood)
  - Section X: Ch.48 (paper)
  - Section XI: Ch.61 (knitted apparel), Ch.62 (woven apparel), Ch.63 (textile articles)
  - Section XII: Ch.64 (footwear)
  - Section XIII: Ch.69 (ceramics)
  - Section XIV: Ch.71 (jewelry)
  - Section XV: Ch.73 (iron/steel)
  - Section XVI: Ch.84 (machinery), Ch.85 (electrical)
  - Section XVII: Ch.87 (vehicles)
  - Section XX: Ch.94 (furniture), Ch.95 (toys/sports), Ch.96 (miscellaneous)
- **Generic few-shot** (`compiler/few-shot/generic.json`) — cross-chapter compilation without chapter-specific examples
- **Expanded vocabulary** — ~80 product chapter routes, ~50 section routes, ~30 synonyms, ~70 function words
- **Context modifier suppression** — prevents usage-context words (electric, industrial, etc.) from overriding product classification
- **Garment-word heuristic** — suppresses raw textile chapters (50-60) when garment keywords are present; woven/knitted discriminator for Ch.61 vs Ch.62
- **Multi-section routing** — handles competing section routes (e.g., "car tire" → both Section VII and XVII)

### Changed
- 144 test cases across 20 chapters (up from 10 cases in 1 chapter)
- 461 total tests (460 passing)
- Classification accuracy: 53% at 4-digit, 74% at chapter level

## [0.2.0] - 2026-04-02

### Added
- **AI-compiled rules for Chapter 87** — build-time LLM pipeline compiles WCO Section/Chapter Notes into deterministic rule sets (exclusion, definition, routing, parts_rule, scope)
- **Rule applier** (`loadRules`, `setRules`, `clearRules`) — integrates compiled rules into `classify()` with pre-scoring, scoring adjustment, and parts-rule phases
- **Web UI demo** — browser-based classifier at tariff-engine.vercel.app (Vite + React, no API server)
- **`setTree()`** — inject HS tree without filesystem access (enables browser bundles)
- **AI compiler CLI** — `compile-rules.ts` pipeline: Notes Parser → Clause Classifier → Rule Generator

### Changed
- `data/rules/` now included in npm package for runtime rule loading
- Chapter 87 classification accuracy improved to 90% at 4-digit level

## [0.1.0] - 2026-03-31

### Added
- Initial release
- HS tree parser (UN Comtrade CSV → `hs-tree.json`)
- Keyword-based section/chapter/heading/subheading matching
- GIR 1-6 conflict resolution
- CLI tool with top candidates, confidence scores, and reasoning paths
- 173 test cases passing
