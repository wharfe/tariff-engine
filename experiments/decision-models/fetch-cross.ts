// experiments/decision-models/fetch-cross.ts
// Build the held-out judge set from US CBP CROSS rulings dated 2026-07-01 or later (all of them, no search terms),
// following the rules fixed in docs/superpowers/specs/2026-10-03-jev-fallback.md before any model answer was seen.
// Writes tests/fixtures/cross-2026h2.json.
//
// Usage: npx tsx experiments/decision-models/fetch-cross.ts

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { HsNode } from "../../src/types.js";

const SINCE = "2026-07-01";
const API = "https://rulings.cbp.gov/api/search?term=classification&collection=ALL&commodityGrouping=ALL&pageSize=100&sortBy=DATE_DESC&page=";

interface Ruling {
  rulingNumber: string;
  rulingDate: string;
  subject: string;
  /** one string, numbers separated by commas / semicolons, e.g. "6109.90.1090, 6110.30.3059" */
  tariffs: string;
}

export interface CrossCase {
  description: string;
  expected4: string;
  expected6: string;
  ruling: string;
  date: string;
  /** the subject alone cannot settle the code (product names, or garments without knit/woven) */
  ambiguous: boolean;
}

function product(subject: string): string | null {
  const s = subject
    .replace(/^\s*RE:\s*/i, "")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .trim();
  const m = s.match(/classification of (.+?) from [^,;]+?\.?\s*$/i);
  if (!m) return null;
  return m[1]
    .replace(/^(?:an?|the)\s+/i, "")
    .replace(/\.$/, "")
    .trim();
}

async function main() {
  const tree = JSON.parse(readFileSync(resolve("data/hs-tree.json"), "utf-8")) as HsNode[];
  const known = new Set(tree.flatMap((c) => c.children.flatMap((h) => h.children.map((s) => s.code))));

  const rulings: Ruling[] = [];
  for (let page = 1; page <= 30; page++) {
    const res = await fetch(API + page);
    if (!res.ok) throw new Error(`CROSS: HTTP ${res.status} on page ${page}`);
    const { rulings: batch } = (await res.json()) as { rulings: Ruling[] };
    if (batch.length === 0) break;
    rulings.push(...batch);
    if (batch[batch.length - 1].rulingDate.slice(0, 10) < SINCE) break;
  }
  const recent = rulings.filter((r) => r.rulingDate.slice(0, 10) >= SINCE);

  const counts = { recent: recent.length, multiTariff: 0, badSubject: 0, notInTree: 0, duplicate: 0, conflicting: 0 };
  const bySubject = new Map<string, CrossCase[]>();
  for (const r of recent) {
    const tariffs = (r.tariffs ?? "").match(/\d{4}\.\d{2}(?:\.\d{2,4})*/g) ?? [];
    if (tariffs.length !== 1) {
      counts.multiTariff++;
      continue;
    }
    const desc = product(r.subject);
    if (!desc) {
      counts.badSubject++;
      continue;
    }
    const code6 = tariffs[0].replace(/\./g, "").slice(0, 6);
    if (!known.has(code6)) {
      counts.notInTree++;
      continue;
    }
    const garment = code6.startsWith("61") || code6.startsWith("62");
    const ambiguous = /[®™"]/.test(desc) || (garment && !/\b(knit|knitted|woven|crochet|crocheted)\b/i.test(desc));
    const c: CrossCase = { description: desc, expected4: code6.slice(0, 4), expected6: code6, ruling: r.rulingNumber, date: r.rulingDate.slice(0, 10), ambiguous };
    const k = desc.toLowerCase();
    bySubject.set(k, [...(bySubject.get(k) ?? []), c]);
  }

  const cases: CrossCase[] = [];
  for (const group of bySubject.values()) {
    if (new Set(group.map((g) => g.expected6)).size > 1) {
      counts.conflicting += group.length;
      continue;
    }
    counts.duplicate += group.length - 1;
    cases.push(group[0]);
  }
  cases.sort((a, b) => a.ruling.localeCompare(b.ruling));
  writeFileSync(resolve("tests/fixtures/cross-2026h2.json"), JSON.stringify(cases, null, 1) + "\n");
  console.log({ ...counts, kept: cases.length, ambiguous: cases.filter((c) => c.ambiguous).length });
}

main().catch((e) => {
  console.error(String(e));
  process.exit(1);
});
