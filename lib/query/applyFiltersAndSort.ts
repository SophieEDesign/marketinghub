import { PostgrestQueryBuilder } from "@supabase/postgrest-js";
import { Filter, Sort } from "../types/filters";

export { applySearch };

/**
 * Apply filters to a Supabase query
 */
export function applyFilters(
  query: any,
  filters: Filter[]
): any {
  if (!filters || filters.length === 0) {
    return query;
  }

  let filteredQuery = query;

  filters.forEach((filter) => {
    const { field, operator, value } = filter;

    switch (operator) {
      case "equals":
        filteredQuery = filteredQuery.eq(field, value);
        break;

      case "not_equals":
        filteredQuery = filteredQuery.neq(field, value);
        break;

      case "contains":
        filteredQuery = filteredQuery.ilike(field, `%${value}%`);
        break;

      case "not_contains":
        filteredQuery = filteredQuery.not("ilike", field, `%${value}%`);
        break;

      case "is_empty":
        // Check for null or empty string
        filteredQuery = filteredQuery.or(`${field}.is.null,${field}.eq.`);
        break;

      case "is_not_empty":
        // Check for not null and not empty
        filteredQuery = filteredQuery.not("or", `${field}.is.null,${field}.eq.`);
        break;

      case "greater_than":
        filteredQuery = filteredQuery.gt(field, value);
        break;

      case "less_than":
        filteredQuery = filteredQuery.lt(field, value);
        break;

      case "greater_than_or_equal":
        filteredQuery = filteredQuery.gte(field, value);
        break;

      case "less_than_or_equal":
        filteredQuery = filteredQuery.lte(field, value);
        break;

      case "on":
        // For date fields, filter by date (ignore time)
        if (value) {
          const dateStr = typeof value === "string" ? value.split("T")[0] : value;
          filteredQuery = filteredQuery.gte(field, `${dateStr}T00:00:00`).lte(field, `${dateStr}T23:59:59`);
        }
        break;

      case "before":
        if (value) {
          const dateStr = typeof value === "string" ? value.split("T")[0] : value;
          filteredQuery = filteredQuery.lt(field, `${dateStr}T00:00:00`);
        }
        break;

      case "after":
        if (value) {
          const dateStr = typeof value === "string" ? value.split("T")[0] : value;
          filteredQuery = filteredQuery.gt(field, `${dateStr}T23:59:59`);
        }
        break;

      case "in_range":
      case "range":
        if (Array.isArray(value) && value.length === 2) {
          const [start, end] = value;
          const startStr = typeof start === "string" ? start.split("T")[0] : start;
          const endStr = typeof end === "string" ? end.split("T")[0] : end;
          filteredQuery = filteredQuery.gte(field, `${startStr}T00:00:00`).lte(field, `${endStr}T23:59:59`);
        }
        break;

      case "includes":
        // For multi-select: check if array field contains value
        if (Array.isArray(value)) {
          // If value is array, check if field array contains any of them
          filteredQuery = filteredQuery.contains(field, value);
        } else {
          // Single value: check if field array contains this value
          filteredQuery = filteredQuery.contains(field, [value]);
        }
        break;

      case "includes_any_of":
        // For multi-select: check if array field contains any of the values
        if (Array.isArray(value)) {
          // Use OR logic: field contains value[0] OR value[1] OR ...
          // Supabase doesn't have direct "contains any" so we use OR with multiple contains
          const orConditions = value.map((v) => `${field}.cs.{${v}}`).join(",");
          filteredQuery = filteredQuery.or(orConditions);
        }
        break;

      case "in":
        if (Array.isArray(value)) {
          filteredQuery = filteredQuery.in(field, value);
        }
        break;

      case "not_in":
        if (Array.isArray(value)) {
          filteredQuery = filteredQuery.not("in", field, value);
        }
        break;

      default:
        console.warn(`Unknown filter operator: ${operator}`);
    }
  });

  return filteredQuery;
}

/**
 * Apply sort to a Supabase query
 */
export function applySort(query: any, sort: Sort[]): any {
  if (!sort || sort.length === 0) {
    return query;
  }

  let sortedQuery = query;

  sort.forEach((sortItem, index) => {
    const { field, direction } = sortItem;
    if (index === 0) {
      sortedQuery = sortedQuery.order(field, { ascending: direction === "asc" });
    } else {
      // For multiple sorts, we need to chain them
      // Note: Supabase supports multiple order() calls, but they're applied in sequence
      sortedQuery = sortedQuery.order(field, { ascending: direction === "asc", nullsFirst: false });
    }
  });

  return sortedQuery;
}

/**
 * Apply search query across multiple text fields
 */
export function applySearch(
  query: any,
  searchQuery: string,
  searchableFields: Array<{ field_key: string }>
): any {
  if (!searchQuery || !searchQuery.trim() || searchableFields.length === 0) {
    return query;
  }

  const trimmedQuery = searchQuery.trim();
  if (!trimmedQuery) {
    return query;
  }

  // Escape special characters for ilike (%, _, \)
  const escapedQuery = trimmedQuery.replace(/[%_\\]/g, '\\$&');
  const searchPattern = `%${escapedQuery}%`;

  // Build OR conditions for all searchable fields
  // Supabase OR format: field1.ilike.%pattern%,field2.ilike.%pattern%,...
  const searchConditions = searchableFields
    .map((field) => `${field.field_key}.ilike.${searchPattern}`)
    .join(",");

  // Apply OR search across all fields
  // If only one field, use direct ilike (more efficient)
  if (searchableFields.length === 1) {
    return query.ilike(searchableFields[0].field_key, searchPattern);
  }

  // Multiple fields: use OR
  return query.or(searchConditions);
}

/**
 * Apply both filters and sort to a query
 */
export function applyFiltersAndSort(
  query: any,
  filters: Filter[],
  sort: Sort[],
  searchQuery?: string,
  searchableFields?: Array<{ field_key: string }>
): any {
  let result = query;
  
  // Apply search first (before filters)
  if (searchQuery && searchableFields && searchableFields.length > 0) {
    result = applySearch(result, searchQuery, searchableFields);
  }
  
  result = applyFilters(result, filters);
  result = applySort(result, sort);
  return result;
}

