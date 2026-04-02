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
