// src/lookup-data.ts
// The phrase table is bundled into the code (tsup / Vite inline the JSON), so npm, CLI and Web all use the
// same table without locating a file at runtime. Rebuild with compiler/build-lookup.ts.

import type { LookupRow } from "./lookup.js";
import table from "../data/lookup.json";

export const BUNDLED_LOOKUP: LookupRow[] = table as LookupRow[];
