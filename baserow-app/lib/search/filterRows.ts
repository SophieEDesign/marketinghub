import type { TableField } from "@/types/fields"

/**
 * Searchable field types that can be searched
 */
const SEARCHABLE_FIELD_TYPES = [
  "text",
  "long_text",
  "email",
  "url",
  "number",
  "currency",
  "percent",
] as const

/**
 * Check if a field type is searchable
 */
function isSearchableFieldType(fieldType: string): boolean {
  return SEARCHABLE_FIELD_TYPES.includes(fieldType as any)
}

/**
 * Normalize a value for searching (convert to string, lowercase, trim)
 */
function normalizeValue(value: any): string {
  if (value === null || value === undefined) {
    return ""
  }
  if (typeof value === "number") {
    return String(value)
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false"
  }
  if (Array.isArray(value)) {
    return value.map(normalizeValue).join(" ")
  }
  if (typeof value === "object") {
    return JSON.stringify(value)
  }
  return String(value).toLowerCase().trim()
}

/**
 * Check if a row matches the search query
 */
function rowMatchesQuery(
  row: Record<string, any>,
  fields: TableField[],
  query: string,
  visibleFieldNames?: string[]
): boolean {
  if (!query || query.trim().length === 0) {
    return true
  }

  const normalizedQuery = query.toLowerCase().trim()
  const searchTerms = normalizedQuery.split(/\s+/).filter((term) => term.length > 0)

  // Filter to only visible fields if provided
  const fieldsToSearch = visibleFieldNames
    ? fields.filter((f) => visibleFieldNames.includes(f.name))
    : fields

  // Only search in searchable field types
  const searchableFields = fieldsToSearch.filter((f) => isSearchableFieldType(f.type))

  // Check if all search terms match in any of the searchable fields
  return searchTerms.every((term) => {
    return searchableFields.some((field) => {
      const fieldValue = row[field.name]
      const normalizedValue = normalizeValue(fieldValue)
      return normalizedValue.includes(term)
    })
  })
}

/**
 * Filter rows by search query
 * Only searches visible fields and searchable field types
 *
 * @param rows - Array of row data objects
 * @param fields - Array of table field definitions
 * @param query - Search query string
 * @param visibleFieldNames - Optional array of visible field names (if not provided, searches all fields)
 * @returns Filtered array of rows
 */
export function filterRowsBySearch(
  rows: Record<string, any>[],
  fields: TableField[],
  query: string,
  visibleFieldNames?: string[]
): Record<string, any>[] {
  if (!query || query.trim().length === 0) {
    return rows
  }

  return rows.filter((row) => rowMatchesQuery(row, fields, query, visibleFieldNames))
}
