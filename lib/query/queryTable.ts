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

    // Always use select("*") to avoid column errors - filter in memory if needed
    // This is safer than trying to select specific columns that might not exist
    query = query.select("*", { count: "exact" });

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
      // Log error for debugging
      console.error(`Error querying table ${table}:`, error);
      
      // If table doesn't exist, return empty result
      if (error.code === "42P01" || error.message?.includes("does not exist")) {
        return {
          data: [],
          count: null,
          error: new Error(`Table "${table}" does not exist`),
        };
      }

      return {
        data: [],
        count: null,
        error: error as any,
      };
    }
    
    // Filter data to only requested fields if specified (in memory)
    // Since we always use select("*"), we can filter in memory if specific fields were requested
    let resultData = data || [];
    if (fields.length > 0 && resultData.length > 0) {
      resultData = resultData.map((row: any) => {
        const filtered: any = {};
        fields.forEach((field: string) => {
          if (row.hasOwnProperty(field)) {
            filtered[field] = row[field];
          }
        });
        // Always include id and metadata fields
        if (row.id) filtered.id = row.id;
        if (row.created_at) filtered.created_at = row.created_at;
        if (row.updated_at) filtered.updated_at = row.updated_at;
        return filtered;
      });
    }

    return {
      data: resultData,
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

