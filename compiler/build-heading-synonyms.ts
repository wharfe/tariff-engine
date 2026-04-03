// compiler/build-heading-synonyms.ts
// Build heading-level synonym table using LLM.
// For each heading, generate everyday product words that consumers would use
// to describe items classified under that heading.
//
// Usage: npx tsx compiler/build-heading-synonyms.ts [--chapters 84,85,87]
//   Default: all chapters with compiled rules in data/rules/

import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

interface HsNode {
  code: string;
  description: string;
  children: HsNode[];
}

const MODEL = "claude-haiku-4-5-20251001";
const BATCH_SIZE = 15; // headings per API call

function loadTree(): HsNode[] {
  return JSON.parse(readFileSync(resolve("data/hs-tree.json"), "utf-8")) as HsNode[];
}

function getTargetChapters(args: string[]): string[] {
  const idx = args.indexOf("--chapters");
  if (idx >= 0 && args[idx + 1]) {
    return args[idx + 1].split(",").map((s) => s.trim());
  }
  // Default: chapters that have compiled rules
  const rulesDir = resolve("data/rules");
  const chapters: string[] = [];
  for (let i = 1; i <= 97; i++) {
    const code = String(i).padStart(2, "0");
    if (existsSync(resolve(rulesDir, `chapter-${code}.json`))) {
      chapters.push(code);
    }
  }
  return chapters;
}

async function generateSynonyms(
  client: Anthropic,
  headings: { code: string; description: string }[],
): Promise<Record<string, string[]>> {
  const headingList = headings
    .map((h) => `${h.code}: ${h.description}`)
    .join("\n");

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: `You are a trade classification expert. For each HS heading, list everyday product words that consumers and e-commerce sellers would use to describe items in that heading.

Rules:
- Output JSON: { "NNNN": ["word1", "word2", ...], ... }
- 5-15 words per heading
- Use lowercase, single words (no phrases)
- Include common product names, brand-category terms, and colloquial names
- Include both US and UK English variants (e.g., tire/tyre)
- Do NOT include words already in the heading description
- Focus on words a shopper would type when searching for these products`,
    messages: [
      {
        role: "user",
        content: `Generate everyday product synonyms for these HS headings:\n\n${headingList}\n\nRespond with JSON only.`,
      },
    ],
  });

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error("No JSON in response:", text.slice(0, 200));
    return {};
  }

  return JSON.parse(jsonMatch[0]) as Record<string, string[]>;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const targetChapters = getTargetChapters(args);
  console.log(`Target chapters: ${targetChapters.join(", ")}`);

  const tree = loadTree();
  const allHeadings: { code: string; description: string }[] = [];

  for (const ch of tree) {
    if (!targetChapters.includes(ch.code)) continue;
    for (const heading of ch.children) {
      allHeadings.push({ code: heading.code, description: heading.description });
    }
  }

  console.log(`Total headings to process: ${allHeadings.length}`);

  // Load existing synonyms if file exists (for incremental updates)
  const outputPath = resolve("data/heading-synonyms.json");
  let result: Record<string, string[]> = {};
  if (existsSync(outputPath)) {
    result = JSON.parse(readFileSync(outputPath, "utf-8")) as Record<string, string[]>;
    console.log(`Loaded ${Object.keys(result).length} existing heading synonyms`);
  }

  const client = new Anthropic();
  let processed = 0;

  // Process in batches
  for (let i = 0; i < allHeadings.length; i += BATCH_SIZE) {
    const batch = allHeadings.slice(i, i + BATCH_SIZE);
    // Skip headings that already have synonyms
    const needsProcessing = batch.filter((h) => !result[h.code]);
    if (needsProcessing.length === 0) {
      processed += batch.length;
      continue;
    }

    try {
      const synonyms = await generateSynonyms(client, needsProcessing);
      for (const [code, words] of Object.entries(synonyms)) {
        // Normalize: lowercase, deduplicate
        result[code] = [...new Set(words.map((w) => w.toLowerCase()))];
      }
      processed += batch.length;
      console.log(`Progress: ${processed}/${allHeadings.length} (batch ${Math.floor(i / BATCH_SIZE) + 1})`);
    } catch (error) {
      console.error(`Batch failed at offset ${i}:`, (error as Error).message);
      // Save partial progress
      break;
    }
  }

  // Sort by heading code
  const sorted: Record<string, string[]> = {};
  for (const key of Object.keys(result).sort()) {
    sorted[key] = result[key];
  }

  writeFileSync(outputPath, JSON.stringify(sorted, null, 2) + "\n", "utf-8");
  console.log(`\nWritten ${Object.keys(sorted).length} heading synonyms to ${outputPath}`);

  // Stats
  const totalWords = Object.values(sorted).reduce((sum, arr) => sum + arr.length, 0);
  console.log(`Total synonym words: ${totalWords}`);
  console.log(`Average per heading: ${(totalWords / Object.keys(sorted).length).toFixed(1)}`);

  // Sample output
  console.log("\nSample:");
  const samples = ["8471", "8517", "6204", "4011", "9503"];
  for (const code of samples) {
    if (sorted[code]) {
      console.log(`  ${code}: ${sorted[code].slice(0, 8).join(", ")}`);
    }
  }
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
