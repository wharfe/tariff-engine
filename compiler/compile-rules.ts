// compiler/compile-rules.ts
// CLI entry point: parse notes -> classify via LLM -> generate rules.json
//
// Usage:
//   npx tsx compiler/compile-rules.ts --chapter 87 \
//     --notes data/notes/chapter-87.md \
//     --section-notes data/notes/section-17.md

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { parseNotes } from "./notes-parser.js";
import { classifyClauses } from "./clause-classifier.js";
import { generateRules } from "./rule-generator.js";

interface CliArgs {
  chapter: string;
  notes: string;
  sectionNotes?: string;
}

function parseArgs(args: string[]): CliArgs {
  const result: Partial<CliArgs> = {};

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--chapter":
        result.chapter = args[++i];
        break;
      case "--notes":
        result.notes = args[++i];
        break;
      case "--section-notes":
        result.sectionNotes = args[++i];
        break;
    }
  }

  if (!result.chapter || !result.notes) {
    console.error(
      "Usage: npx tsx compiler/compile-rules.ts --chapter <num> --notes <path> [--section-notes <path>]",
    );
    process.exit(1);
  }

  return result as CliArgs;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  console.log(`Compiling rules for Chapter ${args.chapter}...`);

  // Step 1: Parse notes
  let markdown = readFileSync(resolve(args.notes), "utf-8");
  if (args.sectionNotes) {
    const sectionMd = readFileSync(resolve(args.sectionNotes), "utf-8");
    markdown = sectionMd + "\n\n" + markdown;
  }

  const clauses = parseNotes(markdown);
  console.log(`Parsed ${clauses.length} clauses`);

  // Step 2: Classify via LLM
  const chapterFewShot = resolve(`compiler/few-shot/chapter-${args.chapter}.json`);
  const genericFewShot = resolve("compiler/few-shot/generic.json");
  const fewShotPath = existsSync(chapterFewShot) ? chapterFewShot : genericFewShot;
  console.log(`Using few-shot: ${fewShotPath}`);
  console.log("Classifying clauses using LLM...");
  const classified = await classifyClauses(clauses, fewShotPath);
  console.log(`Classified ${classified.length} clauses`);

  // Log classification summary
  for (const c of classified) {
    const subLabel = c.subItem ? c.subItem : "";
    console.log(
      `  [${c.clauseType}] Note ${c.noteNumber}${subLabel}: ${c.text.slice(0, 60)}...`,
    );
  }

  // Step 3: Generate rules
  const ruleSet = generateRules(classified, args.chapter);
  console.log(
    `Generated: ${ruleSet.preScoringRules.length} pre-scoring, ` +
    `${ruleSet.scoringRules.length} scoring, ` +
    `${ruleSet.partsRules.length} parts rules`,
  );

  // Step 4: Write output
  const outputPath = resolve(`data/rules/chapter-${args.chapter}.json`);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, JSON.stringify(ruleSet, null, 2) + "\n", "utf-8");
  console.log(`Written to ${outputPath}`);
}

main().catch((err) => {
  console.error("Compile failed:", err);
  process.exit(1);
});
