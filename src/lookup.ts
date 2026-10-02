// src/lookup.ts
// Deterministic lookup into the build-time phrase table (data/lookup.json, verified by Jev at build time).
// The table is bundled into the code (see lookup-data.ts), so nothing is located on disk at runtime.

import type { HsNode } from "./types.js";
import { tokenize } from "./tokenizer.js";
import { cachedStem } from "./stemmer.js";
import { BUNDLED_LOOKUP } from "./lookup-data.js";

export interface LookupRow {
  /** product phrase */
  p: string;
  /** 6-digit subheading */
  c: string;
  /** Jev's heading confidence when the row was verified */
  k: number;
}

export interface LookupHit {
  row: LookupRow;
  score: number;
}

/** Minimum score for a hit to be used. Tuned on tuning phrases only (compiler/tune-lookup-threshold.ts). */
export const LOOKUP_THRESHOLD = 0.88;

/** How strongly extra, unexplained input words pull the score down (0 = not at all). Tuned with the threshold. */
export const LOOKUP_ALPHA = 0.1;

// Input-side negation. Kept separate from scoring.ts CROSS_REF_RE, which reads HS descriptions.
// A bare "non" counts; hyphenated product words such as non-woven or non-alcoholic do not.
const NEGATION_RE = /\b(?:not|without|except|excluding|other\s+than)\b|(?:^|[^\w-])non(?![\w-])/i;

interface Index {
  tree: HsNode[];
  rows: { row: LookupRow; stems: string[] }[];
  postings: Map<string, number[]>;
  idf: Map<string, number>;
  maxIdf: number;
  dropped: number;
}

let table: LookupRow[] | null = BUNDLED_LOOKUP;
let index: Index | null = null;

/** Replace the table (null disables lookup). */
export function setLookup(rows: LookupRow[] | null): void {
  table = rows;
  index = null;
}

export function lookupStatus(): { enabled: boolean; rows: number; dropped: number } {
  return { enabled: table !== null && table.length > 0, rows: index ? index.rows.length : (table?.length ?? 0), dropped: index?.dropped ?? 0 };
}

function stems(text: string): string[] {
  return [...new Set(tokenize(text).map(cachedStem))];
}

function subheadingCodes(tree: HsNode[]): Set<string> {
  const codes = new Set<string>();
  for (const ch of tree) for (const h of ch.children) for (const s of h.children) codes.add(s.code);
  return codes;
}

function buildIndex(rows: LookupRow[], tree: HsNode[]): Index {
  const known = subheadingCodes(tree);
  const kept = rows.filter((r) => known.has(r.c)).map((row) => ({ row, stems: stems(row.p) }));
  const postings = new Map<string, number[]>();
  kept.forEach((r, i) => {
    for (const s of r.stems) {
      const list = postings.get(s);
      if (list) list.push(i);
      else postings.set(s, [i]);
    }
  });
  const idf = new Map<string, number>();
  let maxIdf = 0;
  for (const [s, list] of postings) {
    const w = Math.log(1 + kept.length / list.length);
    idf.set(s, w);
    if (w > maxIdf) maxIdf = w;
  }
  return { tree, rows: kept, postings, idf, maxIdf, dropped: rows.length - kept.length };
}

/**
 * Best table row for a description, or null.
 * score = (shared / row weight) x (shared / input weight)^alpha: mostly "how much of the row is in the input",
 * softened by the share of the input the row explains. Unknown input words weigh as the rarest known word.
 * A hit needs at least 2 shared stems. Ties go to the larger code (same direction as GIR 3(c) in gir.ts).
 */
export function lookup(description: string, tree: HsNode[], alpha = LOOKUP_ALPHA): LookupHit | null {
  if (!table || table.length === 0) return null;
  if (NEGATION_RE.test(description)) return null;
  if (!index || index.tree !== tree) index = buildIndex(table, tree);
  const ix = index;

  const input = stems(description);
  const weight = (s: string) => ix.idf.get(s) ?? ix.maxIdf;
  const inputWeight = input.reduce((sum, s) => sum + weight(s), 0);

  const shared = new Map<number, { w: number; n: number }>();
  for (const s of input) {
    const list = ix.postings.get(s);
    if (!list) continue;
    const w = weight(s);
    for (const i of list) {
      const acc = shared.get(i);
      if (acc) {
        acc.w += w;
        acc.n++;
      } else shared.set(i, { w, n: 1 });
    }
  }

  let best: LookupHit | null = null;
  for (const [i, acc] of shared) {
    if (acc.n < 2) continue;
    const r = ix.rows[i];
    const rowWeight = r.stems.reduce((sum, s) => sum + weight(s), 0);
    const score = (acc.w / rowWeight) * Math.pow(acc.w / inputWeight, alpha);
    if (!best || score > best.score || (score === best.score && r.row.c > best.row.c)) {
      best = { row: r.row, score };
    }
  }
  return best;
}
