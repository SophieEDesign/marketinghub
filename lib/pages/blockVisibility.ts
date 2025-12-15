/**
 * Block Visibility Evaluation
 * 
 * Evaluates whether a block should be visible based on its visibility conditions
 * and the current record context.
 */

import { BlockConfig } from "./blockTypes";

export interface RecordContext {
  [key: string]: any;
}

/**
 * Evaluate if a block should be visible based on its visibility conditions
 */
export function evaluateBlockVisibility(
  block: BlockConfig,
  recordContext?: RecordContext
): boolean {
  // If no visibility conditions, always show
  if (!block.visibility) {
    return true;
  }

  // If no record context provided, can't evaluate - default to visible
  if (!recordContext) {
    return true;
  }

  const { field, operator, value } = block.visibility;

  if (!field || !operator) {
    return true; // Invalid condition, default to visible
  }

  const fieldValue = recordContext[field];

  switch (operator) {
    case "equals":
      return fieldValue === value;
    
    case "not_equals":
      return fieldValue !== value;
    
    case "contains":
      if (typeof fieldValue === "string" && typeof value === "string") {
        return fieldValue.toLowerCase().includes(value.toLowerCase());
      }
      return false;
    
    case "empty":
      return fieldValue === null || fieldValue === undefined || fieldValue === "" || 
             (Array.isArray(fieldValue) && fieldValue.length === 0);
    
    case "not_empty":
      return fieldValue !== null && fieldValue !== undefined && fieldValue !== "" &&
             (!Array.isArray(fieldValue) || fieldValue.length > 0);
    
    default:
      return true; // Unknown operator, default to visible
  }
}

/**
 * Check if user has permission to view block
 */
export function checkBlockPermission(
  block: BlockConfig,
  userRole?: string
): boolean {
  if (!block.allowed_roles || block.allowed_roles.length === 0) {
    return true; // No restrictions
  }

  if (!userRole) {
    return false; // Block requires role but user has none
  }

  return block.allowed_roles.includes(userRole);
}
