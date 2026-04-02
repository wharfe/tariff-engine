// compiler/clause-classifier.ts
// Layer 2: Classify parsed note clauses using LLM (build-time only).

import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "node:fs";
import type { NoteClause, ClassifiedClause, ClauseType } from "./types.js";

const MODEL = "claude-haiku-4-5-20251001";
const MAX_RETRIES = 2;

interface FewShotExample {
  input: string;
  output: { clauseType: string; params: Record<string, unknown> };
}

/**
 * Classify an array of parsed NoteClause using LLM.
 * Makes 1 API call per clause with few-shot examples.
 */
export async function classifyClauses(
  clauses: NoteClause[],
  fewShotPath: string,
): Promise<ClassifiedClause[]> {
  const fewShot: FewShotExample[] = JSON.parse(readFileSync(fewShotPath, "utf-8"));
  const client = new Anthropic();
  const results: ClassifiedClause[] = [];

  for (const clause of clauses) {
    const classified = await classifySingleClause(client, clause, fewShot);
    results.push(classified);
  }

  return results;
}

async function classifySingleClause(
  client: Anthropic,
  clause: NoteClause,
  fewShot: FewShotExample[],
): Promise<ClassifiedClause> {
  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(clause, fewShot);

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      });

      const text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("");

      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error(`No JSON found in response: ${text.slice(0, 200)}`);
      }

      const parsed = JSON.parse(jsonMatch[0]) as {
        clauseType: ClauseType;
        params: Record<string, unknown>;
      };

      // Validate clause type
      const validTypes: ClauseType[] = [
        "exclusion", "definition", "routing", "parts_rule", "scope",
      ];
      if (!validTypes.includes(parsed.clauseType)) {
        throw new Error(`Unknown clause type: ${parsed.clauseType}`);
      }

      return {
        ...clause,
        clauseType: parsed.clauseType,
        params: parsed.params as unknown as ClassifiedClause["params"],
      };
    } catch (error) {
      if (attempt === MAX_RETRIES) {
        console.error(
          `Failed to classify clause after ${MAX_RETRIES + 1} attempts:`,
          clause.text.slice(0, 100),
        );
        throw error;
      }
      console.warn(`Retry ${attempt + 1} for clause: ${clause.text.slice(0, 80)}...`);
    }
  }

  // Unreachable, but TypeScript needs it
  throw new Error("Unreachable");
}

function buildSystemPrompt(): string {
  return `You are a trade classification expert. Your task is to classify each HS (Harmonized System) Note clause into exactly one type and extract structured parameters.

Types:
- exclusion: The clause excludes certain items/codes from a section, chapter, or heading.
- definition: The clause defines a term used in the chapter (e.g., "tractors" means...).
- routing: The clause routes items to a specific heading or chapter based on conditions.
- parts_rule: The clause specifies special treatment for parts/accessories (principal use, stay in own heading, etc.).
- scope: The clause narrows or defines the scope of a specific heading/subheading.

Respond with a JSON object containing "clauseType" and "params" fields. Do not include any explanation outside the JSON.`;
}

function buildUserPrompt(clause: NoteClause, fewShot: FewShotExample[]): string {
  let prompt = "Few-shot examples:\n\n";

  for (const example of fewShot) {
    prompt += `Input: ${example.input}\nOutput: ${JSON.stringify({ clauseType: example.output.clauseType, params: example.output.params })}\n\n`;
  }

  prompt += `Now classify this clause:\nInput: ${clause.text}\nOutput (JSON):`;
  return prompt;
}
