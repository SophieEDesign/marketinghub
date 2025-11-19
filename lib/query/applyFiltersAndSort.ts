import { PostgrestQueryBuilder } from "@supabase/postgrest-js";
import { Filter, Sort } from "../types/filters";

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
        filteredQuery = filteredQuery.or(`${field}.is.null,${field}.eq.`);
        break;

      case "is_not_empty":
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
        if (Array.isArray(value) && value.length === 2) {
          const [start, end] = value;
          const startStr = typeof start === "string" ? start.split("T")[0] : start;
          const endStr = typeof end === "string" ? end.split("T")[0] : end;
          filteredQuery = filteredQuery.gte(field, `${startStr}T00:00:00`).lte(field, `${endStr}T23:59:59`);
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
 * Apply both filters and sort to a query
 */
export function applyFiltersAndSort(
  query: any,
  filters: Filter[],
  sort: Sort[]
): any {
  let result = query;
  result = applyFilters(result, filters);
  result = applySort(result, sort);
  return result;
}

