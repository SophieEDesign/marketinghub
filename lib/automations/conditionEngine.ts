/**
 * Condition Engine for Automations
 * Evaluates whether conditions are met for an automation to proceed
 */

export interface Condition {
  field: string;
  operator:
    | "equals"
    | "not_equals"
    | "contains"
    | ">"
    | "<"
    | ">="
    | "<="
    | "between"
    | "changed_from"
    | "changed_to";
  value: any;
}

/**
 * Evaluate a single condition against a record
 */
export function evaluateCondition(
  condition: Condition,
  record: any,
  oldRecord?: any
): boolean {
  const fieldValue = record[condition.field];
  const oldFieldValue = oldRecord?.[condition.field];

  switch (condition.operator) {
    case "equals":
      return fieldValue === condition.value;

    case "not_equals":
      return fieldValue !== condition.value;

    case "contains":
      return String(fieldValue || "").toLowerCase().includes(
        String(condition.value || "").toLowerCase()
      );

    case ">":
      return Number(fieldValue) > Number(condition.value);

    case "<":
      return Number(fieldValue) < Number(condition.value);

    case ">=":
      return Number(fieldValue) >= Number(condition.value);

    case "<=":
      return Number(fieldValue) <= Number(condition.value);

    case "between":
      if (Array.isArray(condition.value) && condition.value.length === 2) {
        const [min, max] = condition.value;
        const numValue = Number(fieldValue);
        return numValue >= Number(min) && numValue <= Number(max);
      }
      return false;

    case "changed_from":
      // Check if field changed from the specified value
      if (oldRecord === undefined) return false;
      return oldFieldValue === condition.value && fieldValue !== condition.value;

    case "changed_to":
      // Check if field changed to the specified value
      if (oldRecord === undefined) return false;
      return oldFieldValue !== condition.value && fieldValue === condition.value;

    default:
      console.warn(`Unknown condition operator: ${condition.operator}`);
      return false;
  }
}

/**
 * Evaluate all conditions (AND logic - all must be true)
 */
export function evaluateConditions(
  conditions: Condition[],
  record: any,
  oldRecord?: any
): boolean {
  if (!conditions || conditions.length === 0) {
    return true; // No conditions means always true
  }

  // All conditions must be true (AND logic)
  return conditions.every((condition) =>
    evaluateCondition(condition, record, oldRecord)
  );
}

/**
 * Evaluate conditions with OR logic (at least one must be true)
 */
export function evaluateConditionsOR(
  conditions: Condition[],
  record: any,
  oldRecord?: any
): boolean {
  if (!conditions || conditions.length === 0) {
    return true;
  }

  // At least one condition must be true (OR logic)
  return conditions.some((condition) =>
    evaluateCondition(condition, record, oldRecord)
  );
}

