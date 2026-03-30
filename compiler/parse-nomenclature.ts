// compiler/parse-nomenclature.ts

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { HsNode } from "../src/types.js";

/**
 * Parse a CSV line handling quoted fields with commas.
 */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      fields.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  fields.push(current.trim());
  return fields;
}

/**
 * Parse CSV content string into a flat array of HsNode.
 * Skips header row and TOTAL/summary rows.
 */
export function parseCsvContent(csv: string): HsNode[] {
  const lines = csv.split("\n").filter((line) => line.trim() !== "");
  const nodes: HsNode[] = [];

  // Skip header
  for (let i = 1; i < lines.length; i++) {
    const fields = parseCsvLine(lines[i]);
    if (fields.length < 5) continue;

    const [section, hscode, description, parent, levelStr] = fields;

    // Skip TOTAL rows and non-standard levels
    if (section === "TOTAL" || hscode === "TOTAL") continue;
    const level = Number(levelStr);
    if (level !== 2 && level !== 4 && level !== 6) continue;

    nodes.push({
      code: hscode,
      description,
      level,
      section,
      parent: parent === "TOTAL" ? undefined : parent,
      children: [],
    });
  }

  return nodes;
}

/**
 * Build a hierarchical tree from a flat array of HsNode.
 * Chapters (level 2) are roots. Headings (4) are children of chapters.
 * Subheadings (6) are children of headings.
 */
export function buildTree(nodes: HsNode[]): HsNode[] {
  const nodeMap = new Map<string, HsNode>();
  for (const node of nodes) {
    nodeMap.set(node.code, { ...node, children: [] });
  }

  const roots: HsNode[] = [];

  for (const node of nodeMap.values()) {
    if (node.parent && nodeMap.has(node.parent)) {
      nodeMap.get(node.parent)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

// CLI entry point: run when executed directly
const isMain =
  process.argv[1] &&
  (process.argv[1].endsWith("parse-nomenclature.ts") ||
    process.argv[1].endsWith("parse-nomenclature.js"));

if (isMain) {
  const csvPath = "data/raw/data/harmonized-system.csv";
  const outputPath = "data/hs-tree.json";

  try {
    const csv = readFileSync(csvPath, "utf-8");
    const nodes = parseCsvContent(csv);
    const tree = buildTree(nodes);

    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, JSON.stringify(tree, null, 2));

    const chapters = tree.length;
    const headings = tree.reduce((sum, ch) => sum + ch.children.length, 0);
    const subheadings = tree.reduce(
      (sum, ch) =>
        sum + ch.children.reduce((s, h) => s + h.children.length, 0),
      0,
    );

    console.log(`Parsed: ${chapters} chapters, ${headings} headings, ${subheadings} subheadings`);
    console.log(`Output: ${outputPath}`);
  } catch (err) {
    if (
      err instanceof Error &&
      "code" in err &&
      (err as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      console.error(`File not found: ${csvPath}`);
      console.error(
        "Run: git clone https://github.com/datasets/harmonized-system.git data/raw",
      );
    } else {
      throw err;
    }
  }
}
