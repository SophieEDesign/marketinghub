/**
 * Condition Engine for Automations
 * Evaluates whether conditions are met for an automation to proceed
 * 
 * Matches schema definitions from lib/automations/schema.ts
 */

import { Condition, FieldCondition } from "./schema";

/**
 * Evaluate a single condition against a record
 */
export function evaluateCondition(
  condition: Condition,
  record: any,
  oldRecord?: any
): boolean {
  // Handle different condition types
  if (condition.type === "field") {
    const fieldValue = record[condition.field_key];
    const oldFieldValue = oldRecord?.[condition.field_key];

    switch (condition.operator) {
      case "equals":
        return fieldValue === condition.value;

      case "not_equals":
        return fieldValue !== condition.value;

      case "contains":
        return String(fieldValue || "").toLowerCase().includes(
          String(condition.value || "").toLowerCase()
        );

      case "greater_than":
        return Number(fieldValue) > Number(condition.value);

      case "less_than":
        return Number(fieldValue) < Number(condition.value);

      case "is_empty":
        return fieldValue === null || fieldValue === undefined || fieldValue === "";

      case "is_not_empty":
        return fieldValue !== null && fieldValue !== undefined && fieldValue !== "";

      default:
        console.warn(`Unknown condition operator: ${(condition as FieldCondition).operator}`);
        return false;
    }
  }

  if (condition.type === "date") {
    const fieldValue = record[condition.field_key];
    if (!fieldValue) return false;

    const recordDate = new Date(fieldValue);
    const compareDate = condition.value
      ? (typeof condition.value === "string"
          ? new Date(condition.value)
          : new Date(condition.value.start))
      : new Date();

    switch (condition.operator) {
      case "before":
        return recordDate < compareDate;
      case "after":
        return recordDate > compareDate;
      case "equals":
        return recordDate.getTime() === compareDate.getTime();
      case "between":
        if (typeof condition.value === "object" && condition.value.start && condition.value.end) {
          const startDate = new Date(condition.value.start);
          const endDate = new Date(condition.value.end);
          return recordDate >= startDate && recordDate <= endDate;
        }
        return false;
      default:
        return false;
    }
  }

  if (condition.type === "related_record") {
    // For related records, we'd need to fetch the related record first
    // This is a placeholder - implementation would fetch related record
    // and evaluate nested conditions
    console.warn("Related record conditions not yet fully implemented");
    return true; // Default to true for now
  }

  if (condition.type === "logic") {
    // Handle AND/OR logic
    if (condition.operator === "and") {
      return condition.conditions.every((c) =>
        evaluateCondition(c, record, oldRecord)
      );
    } else if (condition.operator === "or") {
      return condition.conditions.some((c) =>
        evaluateCondition(c, record, oldRecord)
      );
    }
  }

  return false;
}

/**
 * Evaluate all conditions (defaults to AND logic - all must be true)
 * Conditions ALWAYS return true if empty array
 */
export function evaluateConditions(
  conditions: Condition[],
  record: any,
  oldRecord?: any
): boolean {
  if (!conditions || conditions.length === 0) {
    return true; // No conditions means always true
  }

  // Default to AND logic - all conditions must be true
  // If there's a logic condition at the top level, it will handle the logic
  // Otherwise, treat as implicit AND
  return conditions.every((condition) =>
    evaluateCondition(condition, record, oldRecord)
  );
}
