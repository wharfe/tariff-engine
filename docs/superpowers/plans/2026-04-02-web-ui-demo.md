# Web UI デモ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** tariff-engine のブラウザデモを1ページのReactアプリとして構築し、URLを共有するだけでHS分類を試せるようにする

**Architecture:** Vite + React + TypeScript のSPA。tariff-engine コアライブラリを直接インポートし、hs-tree.json を静的インポートでバンドルに含める。APIサーバー不要、完全オフライン動作。Vercel にデプロイ。

**Tech Stack:** Vite, React 19, TypeScript, CSS Modules (依存最小限)

---

## File Structure

### Core library changes (minimal)

| Action | File | Purpose |
|--------|------|---------|
| Modify | `src/classifier.ts` | `setTree()` export を追加（ブラウザからツリー注入用） |
| Modify | `src/index.ts` | `setTree` を re-export |
| Create | `tests/set-tree.test.ts` | `setTree` のテスト |

### Web app (new `web/` directory)

| Action | File | Purpose |
|--------|------|---------|
| Create | `web/package.json` | Vite + React 依存関係 |
| Create | `web/tsconfig.json` | TypeScript 設定（ブラウザ向け） |
| Create | `web/index.html` | Vite エントリ HTML |
| Create | `web/vite.config.ts` | Vite 設定（JSON インポート最適化） |
| Create | `web/src/main.tsx` | React エントリポイント + ツリー初期化 |
| Create | `web/src/App.tsx` | メインアプリコンポーネント |
| Create | `web/src/App.module.css` | スタイル |

---

### Task 1: `setTree` をコアライブラリに追加

**Files:**
- Modify: `src/classifier.ts:18-31`
- Modify: `src/index.ts:3`
- Create: `tests/set-tree.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/set-tree.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { setTree, classify } from "../src/index.js";
import type { HsNode } from "../src/index.js";

describe("setTree", () => {
  const minimalTree: HsNode[] = [
    {
      code: "01",
      description: "Live animals",
      level: 2,
      section: "I",
      children: [
        {
          code: "0101",
          description: "Live horses, asses, mules and hinnies",
          level: 4,
          parent: "01",
          children: [
            {
              code: "010110",
              description: "Pure-bred breeding animals",
              level: 6,
              parent: "0101",
              children: [],
            },
          ],
        },
      ],
    },
  ];

  beforeEach(() => {
    // Reset tree state for each test
    setTree(minimalTree);
  });

  it("should allow classify to work after setTree", () => {
    const result = classify({ description: "live horse" });
    expect(result.candidates.length).toBeGreaterThan(0);
    expect(result.candidates[0].hscode).toMatch(/^0101/);
  });

  it("should throw if classify called without loading tree", () => {
    // Force clear the cached tree
    setTree(null as unknown as HsNode[]);
    expect(() => classify({ description: "horse" })).toThrow("Tree not loaded");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/set-tree.test.ts`
Expected: FAIL — `setTree` is not exported from `../src/index.js`

- [ ] **Step 3: Implement setTree in classifier.ts**

Add after line 31 in `src/classifier.ts`:

```ts
export function setTree(tree: HsNode[]): void {
  cachedTree = tree;
}
```

Add to `src/index.ts` line 3:

```ts
export { classify, loadTree, setTree, scoreSection, scoreNodes, scoreSubheading } from "./classifier.js";
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/set-tree.test.ts`
Expected: PASS

- [ ] **Step 5: Run full test suite**

Run: `npx vitest run`
Expected: All existing tests still pass

- [ ] **Step 6: Commit**

```bash
git add src/classifier.ts src/index.ts tests/set-tree.test.ts
git commit -m "feat: add setTree() for browser/non-fs tree injection"
```

---

### Task 2: Web app scaffolding (Vite + React)

**Files:**
- Create: `web/package.json`
- Create: `web/tsconfig.json`
- Create: `web/index.html`
- Create: `web/vite.config.ts`

- [ ] **Step 1: Create `web/package.json`**

```json
{
  "name": "tariff-engine-demo",
  "private": true,
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^19.1.0",
    "react-dom": "^19.1.0"
  },
  "devDependencies": {
    "@types/react": "^19.1.2",
    "@types/react-dom": "^19.1.2",
    "@vitejs/plugin-react": "^4.5.2",
    "typescript": "^6.0.2",
    "vite": "^6.3.5"
  }
}
```

- [ ] **Step 2: Create `web/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "jsx": "react-jsx",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "paths": {
      "tariff-engine": ["../src/index.ts"]
    }
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `web/vite.config.ts`**

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "tariff-engine": resolve(__dirname, "../src/index.ts"),
    },
  },
  json: {
    stringify: true,
  },
});
```

Note: `json.stringify: true` makes Vite handle large JSON imports more efficiently by converting to `export default JSON.parse("...")` instead of inlining as a JS object literal.

- [ ] **Step 4: Create `web/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Tariff Engine — HS Code Classifier Demo</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Install dependencies**

```bash
cd web && npm install
```

- [ ] **Step 6: Commit**

```bash
git add web/package.json web/tsconfig.json web/vite.config.ts web/index.html web/package-lock.json
git commit -m "chore: scaffold web demo with Vite + React"
```

---

### Task 3: React app — entry point with tree initialization

**Files:**
- Create: `web/src/main.tsx`
- Create: `web/src/vite-env.d.ts`

- [ ] **Step 1: Create `web/src/vite-env.d.ts`**

```ts
/// <reference types="vite/client" />
```

- [ ] **Step 2: Create `web/src/main.tsx`**

This is the critical file: it imports hs-tree.json as a static module (Vite bundles it), calls `setTree()` to inject the tree, then renders the app.

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { setTree } from "tariff-engine";
import hsTree from "../../data/hs-tree.json";
import { App } from "./App";

// Inject HS tree into tariff-engine before any classify() call
setTree(hsTree);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 3: Create placeholder `web/src/App.tsx`**

```tsx
export function App() {
  return <div>Tariff Engine Demo — loading...</div>;
}
```

- [ ] **Step 4: Verify dev server starts**

```bash
cd web && npx vite --open
```

Expected: Browser opens, shows "Tariff Engine Demo — loading..." with no console errors.

- [ ] **Step 5: Commit**

```bash
git add web/src/main.tsx web/src/vite-env.d.ts web/src/App.tsx
git commit -m "feat(web): entry point with static HS tree injection"
```

---

### Task 4: Main UI — search input + results display

**Files:**
- Modify: `web/src/App.tsx`
- Create: `web/src/App.module.css`

- [ ] **Step 1: Implement `App.tsx`**

Single component with state for input, results, and reasoning toggle. No component splitting needed — this is a one-page app.

```tsx
import { useState, useCallback } from "react";
import { classify } from "tariff-engine";
import type { ClassifyResult } from "tariff-engine";
import styles from "./App.module.css";

const EXAMPLES = [
  "wooden dining table",
  "lithium-ion battery for electric vehicle",
  "men's cotton t-shirt",
  "stainless steel surgical scalpel",
  "fresh frozen atlantic salmon fillet",
];

export function App() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<ClassifyResult | null>(null);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState<number | null>(null);

  const handleClassify = useCallback(() => {
    const trimmed = query.trim();
    if (!trimmed) return;
    const start = performance.now();
    const r = classify({ description: trimmed });
    setElapsed(performance.now() - start);
    setResult(r);
    setExpandedIndex(null);
  }, [query]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleClassify();
      }
    },
    [handleClassify],
  );

  const handleExample = useCallback((example: string) => {
    setQuery(example);
    const start = performance.now();
    const r = classify({ description: example });
    setElapsed(performance.now() - start);
    setResult(r);
    setExpandedIndex(null);
  }, []);

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Tariff Engine</h1>
        <p className={styles.subtitle}>
          HS Code Classifier — offline, deterministic, explainable
        </p>
      </header>

      <main className={styles.main}>
        <div className={styles.inputGroup}>
          <textarea
            className={styles.textarea}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter a product description, e.g. &quot;wooden dining table&quot;"
            rows={2}
          />
          <button
            className={styles.button}
            onClick={handleClassify}
            disabled={!query.trim()}
          >
            Classify
          </button>
        </div>

        <div className={styles.examples}>
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              className={styles.exampleChip}
              onClick={() => handleExample(ex)}
            >
              {ex}
            </button>
          ))}
        </div>

        {result && (
          <div className={styles.results}>
            {elapsed !== null && (
              <p className={styles.elapsed}>{elapsed.toFixed(0)}ms</p>
            )}

            {result.needs_review && (
              <p className={styles.warning}>
                Low confidence — manual review recommended
              </p>
            )}

            {result.candidates.length === 0 ? (
              <p className={styles.noResults}>No candidates found.</p>
            ) : (
              result.candidates.map((c, i) => (
                <div key={c.hscode} className={styles.card}>
                  <div className={styles.cardHeader}>
                    <span className={styles.hscode}>{c.hscode}</span>
                    <span className={styles.confidence}>
                      {(c.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                  <p className={styles.description}>{c.description}</p>
                  <button
                    className={styles.reasoningToggle}
                    onClick={() =>
                      setExpandedIndex(expandedIndex === i ? null : i)
                    }
                  >
                    {expandedIndex === i ? "Hide" : "Show"} reasoning
                  </button>
                  {expandedIndex === i && (
                    <ul className={styles.reasoning}>
                      {c.reasoning.map((r, j) => (
                        <li key={j}>{r}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </main>

      <footer className={styles.footer}>
        <a href="https://github.com/wharfe/tariff-engine" target="_blank" rel="noopener noreferrer">
          GitHub
        </a>
        {" · "}
        <a href="https://www.npmjs.com/package/tariff-engine" target="_blank" rel="noopener noreferrer">
          npm
        </a>
        {" · "}
        <span>No server — runs entirely in your browser</span>
      </footer>
    </div>
  );
}
```

- [ ] **Step 2: Implement `App.module.css`**

Minimal, clean styling. No CSS framework. Dark-on-light, monospace accents for HS codes.

```css
.container {
  max-width: 640px;
  margin: 0 auto;
  padding: 2rem 1rem;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  color: #1a1a1a;
}

.header {
  text-align: center;
  margin-bottom: 2rem;
}

.title {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0;
}

.subtitle {
  font-size: 0.875rem;
  color: #666;
  margin: 0.25rem 0 0;
}

.main {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.inputGroup {
  display: flex;
  gap: 0.5rem;
}

.textarea {
  flex: 1;
  padding: 0.75rem;
  font-size: 1rem;
  border: 1px solid #ccc;
  border-radius: 6px;
  resize: vertical;
  font-family: inherit;
}

.textarea:focus {
  outline: none;
  border-color: #0066cc;
  box-shadow: 0 0 0 2px rgba(0, 102, 204, 0.2);
}

.button {
  padding: 0.75rem 1.5rem;
  font-size: 1rem;
  font-weight: 600;
  color: #fff;
  background: #0066cc;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  white-space: nowrap;
  align-self: flex-start;
}

.button:hover:not(:disabled) {
  background: #0052a3;
}

.button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.examples {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.exampleChip {
  padding: 0.25rem 0.75rem;
  font-size: 0.8rem;
  color: #444;
  background: #f0f0f0;
  border: 1px solid #ddd;
  border-radius: 100px;
  cursor: pointer;
}

.exampleChip:hover {
  background: #e0e0e0;
}

.results {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-top: 0.5rem;
}

.elapsed {
  font-size: 0.8rem;
  color: #888;
  margin: 0;
  text-align: right;
}

.warning {
  padding: 0.5rem 0.75rem;
  font-size: 0.875rem;
  color: #856404;
  background: #fff3cd;
  border: 1px solid #ffc107;
  border-radius: 6px;
  margin: 0;
}

.noResults {
  color: #666;
  text-align: center;
  margin: 1rem 0;
}

.card {
  padding: 1rem;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  background: #fafafa;
}

.cardHeader {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 0.25rem;
}

.hscode {
  font-family: "SF Mono", "Cascadia Code", "Consolas", monospace;
  font-size: 1.125rem;
  font-weight: 700;
  color: #0066cc;
}

.confidence {
  font-size: 0.875rem;
  font-weight: 600;
  color: #444;
}

.description {
  font-size: 0.875rem;
  color: #333;
  margin: 0.25rem 0 0.5rem;
}

.reasoningToggle {
  font-size: 0.75rem;
  color: #666;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  text-decoration: underline;
}

.reasoningToggle:hover {
  color: #333;
}

.reasoning {
  margin: 0.5rem 0 0;
  padding-left: 1.25rem;
  font-size: 0.8rem;
  color: #555;
  line-height: 1.6;
}

.footer {
  margin-top: 3rem;
  padding-top: 1rem;
  border-top: 1px solid #e0e0e0;
  text-align: center;
  font-size: 0.75rem;
  color: #888;
}

.footer a {
  color: #0066cc;
  text-decoration: none;
}

.footer a:hover {
  text-decoration: underline;
}
```

- [ ] **Step 3: Verify in browser**

```bash
cd web && npx vite
```

Expected: App renders with text input, example chips, classify button. Click an example → shows 3 candidate cards with HS codes, confidence %, description, and expandable reasoning.

- [ ] **Step 4: Commit**

```bash
git add web/src/App.tsx web/src/App.module.css
git commit -m "feat(web): classify UI with results cards and reasoning toggle"
```

---

### Task 5: Node.js polyfill exclusion + build verification

**Files:**
- Modify: `web/vite.config.ts`

The core library imports `node:fs` and `node:path` in `classifier.ts`. These are only used by `loadTree()`, never by `classify()` or `setTree()`. Vite needs to handle this — tree-shaking should eliminate the unused `loadTree` code path, but we may need to stub the Node built-ins.

- [ ] **Step 1: Test production build**

```bash
cd web && npx vite build 2>&1
```

If the build succeeds with no errors about `node:fs`, tree-shaking handled it. If it fails, proceed to Step 2.

- [ ] **Step 2: (If needed) Add Node built-in stubs to vite.config.ts**

Update `web/vite.config.ts` resolve config:

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "tariff-engine": resolve(__dirname, "../src/index.ts"),
      "node:fs": resolve(__dirname, "src/stubs/fs.ts"),
      "node:path": resolve(__dirname, "src/stubs/path.ts"),
    },
  },
  json: {
    stringify: true,
  },
});
```

Create `web/src/stubs/fs.ts`:

```ts
// Stub: loadTree() is not called in browser — setTree() is used instead.
export function readFileSync(): never {
  throw new Error("readFileSync is not available in browser. Use setTree() instead.");
}
```

Create `web/src/stubs/path.ts`:

```ts
// Stub: path.resolve is not needed in browser.
export function resolve(...segments: string[]): string {
  return segments.join("/");
}
```

- [ ] **Step 3: Verify production build succeeds**

```bash
cd web && npx vite build
```

Expected: Build succeeds. Check output size:

```bash
ls -lh web/dist/assets/
```

Expected: JS bundle ~300-500KB (gzip), mostly hs-tree.json data.

- [ ] **Step 4: Test production preview**

```bash
cd web && npx vite preview
```

Expected: Works identically to dev mode.

- [ ] **Step 5: Commit**

```bash
git add web/vite.config.ts web/src/stubs/
git commit -m "fix(web): stub Node built-ins for browser build"
```

(Only commit stubs if they were needed in Step 2.)

---

### Task 6: Vercel deployment setup

**Files:**
- Create: `web/vercel.json` (optional, only if needed)

- [ ] **Step 1: Add `.gitignore` for web**

Append to root `.gitignore` or create `web/.gitignore`:

```
node_modules
dist
```

- [ ] **Step 2: Deploy to Vercel**

```bash
cd web && npx vercel --prod
```

Follow prompts:
- Project name: `tariff-engine-demo`
- Framework: Vite
- Root directory: `web`
- Build command: `npm run build`
- Output directory: `dist`

If using Vercel dashboard instead: import the GitHub repo, set root directory to `web`.

- [ ] **Step 3: Verify deployed URL**

Open the Vercel URL in browser. Enter "wooden dining table" → verify 3 candidates appear with reasoning.

- [ ] **Step 4: Commit deployment config**

```bash
git add web/.gitignore web/vercel.json
git commit -m "chore(web): Vercel deployment config"
```

---

### Task 7: README update with demo link

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add demo link to README**

Add a "Try it" line near the top of README.md, right after the description:

```markdown
**[Try the live demo →](https://tariff-engine-demo.vercel.app)**
```

(Replace URL with actual Vercel deployment URL.)

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add live demo link to README"
```
