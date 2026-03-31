// cli/index.ts

import { classify, loadTree } from "../src/index.js";

const args = process.argv.slice(2);
const command = args[0];

if (command === "classify" && args[1]) {
  loadTree();
  const result = classify({ description: args[1] });
  if (result.candidates.length === 0) {
    console.log("No candidates found.");
  } else {
    for (const c of result.candidates) {
      console.log(`${c.hscode} (${(c.confidence * 100).toFixed(0)}%) - ${c.description}`);
      for (const r of c.reasoning) {
        console.log(`  → ${r}`);
      }
      console.log();
    }
  }
  if (result.needs_review) {
    console.log("⚠ Low confidence — manual review recommended.");
  }
} else {
  console.log("Usage: tariff-engine classify <description>");
  console.log('Example: tariff-engine classify "wooden dining table"');
}
