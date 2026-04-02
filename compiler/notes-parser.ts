// compiler/notes-parser.ts
// Layer 1: Parse structured notes markdown into NoteClause array.

import type { NoteClause } from "./types.js";

type NoteSource = "section" | "chapter" | "subheading";

const SECTION_HEADER = /^## Section [A-Z]+ Notes/m;
const CHAPTER_HEADER = /^## Chapter \d+ Notes/m;
const SUBHEADING_HEADER = /^## Subheading Notes/m;

interface SectionBlock {
  source: NoteSource;
  body: string;
}

export function parseNotes(markdown: string): NoteClause[] {
  if (!markdown.trim()) return [];

  const blocks = splitIntoSectionBlocks(markdown);
  if (blocks.length === 0) return [];

  const clauses: NoteClause[] = [];
  for (const block of blocks) {
    clauses.push(...parseBlock(block));
  }
  return clauses;
}

function splitIntoSectionBlocks(markdown: string): SectionBlock[] {
  const blocks: SectionBlock[] = [];
  const lines = markdown.split("\n");
  let currentSource: NoteSource | null = null;
  let currentLines: string[] = [];

  for (const line of lines) {
    if (SECTION_HEADER.test(line)) {
      if (currentSource !== null) {
        blocks.push({ source: currentSource, body: currentLines.join("\n") });
      }
      currentSource = "section";
      currentLines = [];
    } else if (CHAPTER_HEADER.test(line)) {
      if (currentSource !== null) {
        blocks.push({ source: currentSource, body: currentLines.join("\n") });
      }
      currentSource = "chapter";
      currentLines = [];
    } else if (SUBHEADING_HEADER.test(line)) {
      if (currentSource !== null) {
        blocks.push({ source: currentSource, body: currentLines.join("\n") });
      }
      currentSource = "subheading";
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }

  if (currentSource !== null) {
    blocks.push({ source: currentSource, body: currentLines.join("\n") });
  }

  return blocks;
}

function parseBlock(block: SectionBlock): NoteClause[] {
  const { source, body } = block;
  const clauses: NoteClause[] = [];

  const noteChunks = splitByNumberedNotes(body);

  for (const { noteNumber, text } of noteChunks) {
    const subItems = splitBySubItems(text);

    if (subItems.length > 0) {
      for (const sub of subItems) {
        clauses.push({
          source,
          noteNumber,
          subItem: sub.label,
          text: sub.text.trim(),
        });
      }
    } else {
      const paragraphs = splitByParagraphs(text);
      for (const para of paragraphs) {
        clauses.push({
          source,
          noteNumber,
          text: para.trim(),
        });
      }
    }
  }

  return clauses;
}

function splitByNumberedNotes(body: string): { noteNumber: number; text: string }[] {
  const results: { noteNumber: number; text: string }[] = [];
  const re = /^(\d+)\.\s/gm;
  const matches: { index: number; noteNumber: number }[] = [];

  let match: RegExpExecArray | null;
  while ((match = re.exec(body)) !== null) {
    matches.push({ index: match.index, noteNumber: parseInt(match[1], 10) });
  }

  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index + String(matches[i].noteNumber).length + 2;
    const end = i + 1 < matches.length ? matches[i + 1].index : body.length;
    const text = body.slice(start, end).trim();
    if (text) {
      results.push({ noteNumber: matches[i].noteNumber, text });
    }
  }

  return results;
}

function splitBySubItems(text: string): { label: string; text: string }[] {
  const re = /^\s*\(([a-z]+)\)\s/gm;
  const matches: { index: number; label: string; fullMatch: string }[] = [];

  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    matches.push({ index: match.index, label: `(${match[1]})`, fullMatch: match[0] });
  }

  if (matches.length === 0) return [];

  const results: { label: string; text: string }[] = [];
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index + matches[i].fullMatch.length;
    const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
    const subText = text.slice(start, end).trim();
    if (subText) {
      results.push({ label: matches[i].label, text: subText });
    }
  }

  return results;
}

function splitByParagraphs(text: string): string[] {
  const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  return paragraphs.length > 0 ? paragraphs : [text];
}
