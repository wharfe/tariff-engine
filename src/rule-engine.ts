// src/rule-engine.ts

import type { RuleCondition } from "./types.js";

export function evaluateCondition(
  condition: RuleCondition,
  attributes: Record<string, string | number | undefined>,
): boolean {
  const value = attributes[condition.field];
  if (value === undefined) return false;

  switch (condition.type) {
    case "equals":
      return String(value).toLowerCase() === String(condition.value).toLowerCase();
    case "contains":
      return String(value).includes(String(condition.value));
    case "not_contains":
      return !String(value).includes(String(condition.value));
    case "gt":
      return Number(value) > Number(condition.value);
    case "lt":
      return Number(value) < Number(condition.value);
    case "gte":
      return Number(value) >= Number(condition.value);
    case "lte":
      return Number(value) <= Number(condition.value);
  }
}
