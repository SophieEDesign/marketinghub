import { supabase } from "@/lib/supabaseClient";
import { Filter, Sort } from "@/lib/types/filters";

export interface QueryTableOptions {
  table: string;
  fields?: string[]; // If not provided, selects all (*)
  filters?: Filter[];
  sort?: Sort[];
  group?: string; // Field name to group by
  limit?: number;
  offset?: number;
  _retryCount?: number; // Internal flag to prevent infinite recursion
}

export interface QueryTableResult {
  data: any[];
  count: number | null;
  error: Error | null;
}

/**
 * Dynamic query engine for querying any table with filters, sort, grouping, etc.
 * This replaces hardcoded table queries throughout the codebase.
 */
export async function queryTable(options: QueryTableOptions): Promise<QueryTableResult> {
  const {
    table,
    fields = [],
    filters = [],
    sort = [],
    group,
    limit,
    offset = 0,
    _retryCount = 0,
  } = options;

  try {
    // Build the select query
    let query: any = supabase.from(table);

    // Select specific fields or all
    if (fields.length > 0) {
      const selectFields = fields.join(", ");
      query = query.select(selectFields, { count: "exact" });
    } else {
      query = query.select("*", { count: "exact" });
    }

    // Apply filters
    query = applyFilters(query, filters);

    // Apply sorting
    query = applySort(query, sort);

    // Apply grouping (if supported by the query type)
    if (group) {
      // Note: Supabase doesn't support GROUP BY directly in the client
      // This would need to be handled via a database function or RPC call
      // For now, we'll apply it as a filter/aggregation if needed
    }

    // Apply pagination
    if (limit) {
      query = query.range(offset, offset + limit - 1);
    } else if (offset > 0) {
      query = query.range(offset, offset + 999); // Large range if no limit
    }

    const { data, error, count } = await query;

    if (error) {
      // If error is due to missing columns, try with select all (but only once to prevent infinite loops)
      if (
        _retryCount === 0 &&
        (error.code === "42703" ||
        error.message?.includes("does not exist") ||
        error.message?.includes("column"))
      ) {
        console.warn(
          `Some columns don't exist for table ${table}, falling back to select('*'):`,
          error
        );
        return queryTable({ ...options, fields: [], _retryCount: 1 });
      }

      return {
        data: [],
        count: null,
        error: error as any,
      };
    }

    return {
      data: data || [],
      count: count || null,
      error: null,
    };
  } catch (error: any) {
    console.error(`Error querying table ${table}:`, error);
    return {
      data: [],
      count: null,
      error: error as Error,
    };
  }
}

/**
 * Apply filters to a Supabase query
 */
function applyFilters(query: any, filters: Filter[]): any {
  let result = query;

  for (const filter of filters) {
    const { field, operator, value } = filter;

    switch (operator) {
      case "equals":
        result = result.eq(field, value);
        break;
      case "not_equals":
        result = result.neq(field, value);
        break;
      case "greater_than":
        result = result.gt(field, value);
        break;
      case "greater_than_or_equal":
        result = result.gte(field, value);
        break;
      case "less_than":
        result = result.lt(field, value);
        break;
      case "less_than_or_equal":
        result = result.lte(field, value);
        break;
      case "contains":
        result = result.ilike(field, `%${value}%`);
        break;
      case "not_contains":
        result = result.not("ilike", field, `%${value}%`);
        break;
      case "is_empty":
        result = result.or(`${field}.is.null,${field}.eq.`);
        break;
      case "is_not_empty":
        result = result.not("or", `${field}.is.null,${field}.eq.`);
        break;
      case "on":
        // For date fields, filter by date (ignore time)
        if (value) {
          const dateStr = typeof value === "string" ? value.split("T")[0] : value;
          result = result.gte(field, `${dateStr}T00:00:00`).lte(field, `${dateStr}T23:59:59`);
        }
        break;
      case "before":
        if (value) {
          const dateStr = typeof value === "string" ? value.split("T")[0] : value;
          result = result.lt(field, `${dateStr}T00:00:00`);
        }
        break;
      case "after":
        if (value) {
          const dateStr = typeof value === "string" ? value.split("T")[0] : value;
          result = result.gt(field, `${dateStr}T23:59:59`);
        }
        break;
      case "in_range":
      case "range":
        if (Array.isArray(value) && value.length === 2) {
          const [start, end] = value;
          const startStr = typeof start === "string" ? start.split("T")[0] : start;
          const endStr = typeof end === "string" ? end.split("T")[0] : end;
          result = result.gte(field, `${startStr}T00:00:00`).lte(field, `${endStr}T23:59:59`);
        }
        break;
      case "includes":
        // For multi-select: check if array field contains value
        if (Array.isArray(value)) {
          result = result.contains(field, value);
        } else {
          result = result.contains(field, [value]);
        }
        break;
      case "includes_any_of":
        // For multi-select: check if array field contains any of the values
        if (Array.isArray(value)) {
          const orConditions = value.map((v) => `${field}.cs.{${v}}`).join(",");
          result = result.or(orConditions);
        }
        break;
      case "in":
        if (Array.isArray(value)) {
          result = result.in(field, value);
        }
        break;
      case "not_in":
        if (Array.isArray(value)) {
          result = result.not("in", field, value);
        }
        break;
      default:
        console.warn(`Unknown filter operator: ${operator}`);
    }
  }

  return result;
}

/**
 * Apply sorting to a Supabase query
 */
function applySort(query: any, sort: Sort[]): any {
  let result = query;

  if (sort.length === 0) {
    // Default sort by created_at descending
    return result.order("created_at", { ascending: false });
  }

  for (let i = 0; i < sort.length; i++) {
    const { field, direction } = sort[i];
    const ascending = direction === "asc";
    
    if (i === 0) {
      result = result.order(field, { ascending });
    } else {
      // Supabase supports multiple order clauses
      result = result.order(field, { ascending, nullsFirst: false });
    }
  }

  return result;
}

/**
 * Get count of records matching filters (without fetching data)
 */
export async function queryTableCount(
  table: string,
  filters: Filter[] = []
): Promise<number> {
  try {
    let query = supabase.from(table).select("*", { count: "exact", head: true });
    query = applyFilters(query, filters);
    const { count, error } = await query;

    if (error) {
      console.error(`Error counting table ${table}:`, error);
      return 0;
    }

    return count || 0;
  } catch (error) {
    console.error(`Error counting table ${table}:`, error);
    return 0;
  }
}

