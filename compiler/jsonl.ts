// compiler/jsonl.ts
// Append-only JSONL helpers shared by the resumable lookup-table build steps.

import { appendFileSync, existsSync, readFileSync } from "node:fs";

/** An interrupted run can leave a last line without "\n"; the next append would glue onto it. */
export function endWithNewline(file: string): void {
  if (existsSync(file)) {
    const text = readFileSync(file, "utf-8");
    if (text.length > 0 && !text.endsWith("\n")) appendFileSync(file, "\n");
  }
}

/** Parse every intact line; empty or torn lines are skipped. */
export function readJsonl<T>(file: string): T[] {
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf-8")
    .split("\n")
    .flatMap((l) => {
      try {
        return [JSON.parse(l) as T];
      } catch {
        return [];
      }
    });
}
