/**
 * Filter and Sort Type Definitions
 */

export type FilterOperator =
  | "equals"
  | "not_equals"
  | "contains"
  | "not_contains"
  | "includes"
  | "includes_any_of"
  | "is_empty"
  | "is_not_empty"
  | "greater_than"
  | "less_than"
  | "greater_than_or_equal"
  | "less_than_or_equal"
  | "on"
  | "before"
  | "after"
  | "in_range"
  | "range"
  | "in"
  | "not_in";

export interface Filter {
  id: string;
  field: string; // field_key
  operator: FilterOperator;
  value: any;
}

export interface Sort {
  id: string;
  field: string; // field_key
  direction: "asc" | "desc";
}

export interface ViewSettings {
  id: string;
  table_id: string;
  view_id: string;
  filters: Filter[];
  sort: Sort[];
  visible_fields?: string[]; // Array of field IDs
  field_order?: string[]; // Array of field IDs in order
  kanban_group_field?: string; // field_key
  calendar_date_field?: string; // field_key
  timeline_date_field?: string; // field_key
  row_height?: "compact" | "medium" | "tall";
  card_fields?: string[]; // Array of field IDs for card layout
  updated_at: string;
}

/**
 * Get available operators for a field type
 */
export function getOperatorsForFieldType(fieldType: string): FilterOperator[] {
  switch (fieldType) {
    case "text":
    case "long_text":
      return ["equals", "not_equals", "contains", "not_contains", "is_empty", "is_not_empty"];

    case "number":
      return [
        "equals",
        "not_equals",
        "greater_than",
        "less_than",
        "greater_than_or_equal",
        "less_than_or_equal",
        "is_empty",
        "is_not_empty",
      ];

    case "date":
      return ["on", "before", "after", "in_range", "is_empty", "is_not_empty"];

    case "single_select":
      return ["equals", "not_equals", "in", "not_in", "is_empty", "is_not_empty"];

    case "multi_select":
      return ["contains", "not_contains", "includes", "includes_any_of", "is_empty", "is_not_empty"];

    case "boolean":
      return ["equals", "is_empty", "is_not_empty"];

    case "linked_record":
      return ["equals", "not_equals", "is_empty", "is_not_empty"];

    default:
      return ["equals", "not_equals", "contains", "is_empty", "is_not_empty"];
  }
}

/**
 * Get operator label for display
 */
export function getOperatorLabel(operator: FilterOperator): string {
  const labels: Record<FilterOperator, string> = {
    equals: "equals",
    not_equals: "does not equal",
    contains: "contains",
    not_contains: "does not contain",
    is_empty: "is empty",
    is_not_empty: "is not empty",
    greater_than: "is greater than",
    less_than: "is less than",
    greater_than_or_equal: "is greater than or equal to",
    less_than_or_equal: "is less than or equal to",
    on: "on",
    before: "is before",
    after: "is after",
    in_range: "is between",
    range: "is between",
    in: "is one of",
    not_in: "is not one of",
    includes: "includes",
    includes_any_of: "includes any of",
  };
  return labels[operator] || operator;
}

