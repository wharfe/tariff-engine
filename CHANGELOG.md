# Changelog

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
