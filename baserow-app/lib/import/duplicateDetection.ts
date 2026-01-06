/**
 * Normalize a value for duplicate detection
 * - Trim whitespace
 * - Convert to lowercase
 * - Remove invisible characters
 */
export function normalizeValue(value: any): string {
  if (value === null || value === undefined) {
    return ''
  }
  
  // Convert to string and trim
  let normalized = String(value).trim()
  
  // Convert to lowercase
  normalized = normalized.toLowerCase()
  
  // Remove invisible characters (zero-width spaces, non-breaking spaces, etc.)
  // Keep only printable characters
  normalized = normalized.replace(/[\u200B-\u200D\uFEFF\u00A0]/g, '')
  
  // Remove other control characters except newlines and tabs (for multi-line fields)
  normalized = normalized.replace(/[\u0000-\u0008\u000B-\u001F\u007F-\u009F]/g, '')
  
  return normalized
}

/**
 * Check for duplicate values in the database
 * @param supabase - Supabase client
 * @param tableName - Name of the Supabase table
 * @param fieldName - Name of the field to check for duplicates
 * @param values - Array of normalized values to check
 * @returns Set of duplicate values found in the database
 */
export async function checkDuplicates(
  supabase: any,
  tableName: string,
  fieldName: string,
  values: string[]
): Promise<Set<string>> {
  if (values.length === 0) {
    return new Set()
  }

  // Filter out empty values
  const nonEmptyValues = values.filter(v => v !== '')
  
  if (nonEmptyValues.length === 0) {
    return new Set()
  }

  // Query database for existing records
  // We need to normalize the database values for comparison
  // Since we can't do case-insensitive comparison directly in PostgREST easily,
  // we'll fetch all records and normalize them client-side
  
  // For large datasets, we might want to optimize this, but for now
  // we'll fetch records where the field is not null/empty
  const { data: existingRecords, error } = await supabase
    .from(tableName)
    .select(fieldName)
    .not(fieldName, 'is', null)
    .neq(fieldName, '')

  if (error) {
    // If column doesn't exist or other error, log but don't fail
    console.warn('Error checking duplicates:', error)
    return new Set()
  }

  // Normalize existing values and create a set for fast lookup
  const existingNormalized = new Set<string>()
  if (existingRecords) {
    existingRecords.forEach((record: any) => {
      const value = record[fieldName]
      if (value !== null && value !== undefined) {
        const normalized = normalizeValue(value)
        if (normalized) {
          existingNormalized.add(normalized)
        }
      }
    })
  }

  // Check which CSV values are duplicates
  const duplicates = new Set<string>()
  nonEmptyValues.forEach(value => {
    if (existingNormalized.has(value)) {
      duplicates.add(value)
    }
  })

  return duplicates
}

/**
 * Filter rows to remove duplicates
 * @param rows - Array of rows to filter
 * @param primaryKeyField - Name of the field to use for duplicate detection
 * @param duplicates - Set of duplicate normalized values
 * @returns Object with filtered rows and skipped rows
 */
export function filterDuplicateRows<T extends Record<string, any>>(
  rows: T[],
  primaryKeyField: string,
  duplicates: Set<string>
): {
  rowsToInsert: T[]
  skippedRows: Array<{ row: T; reason: string; value: any }>
} {
  const rowsToInsert: T[] = []
  const skippedRows: Array<{ row: T; reason: string; value: any }> = []

  rows.forEach((row) => {
    const value = row[primaryKeyField]
    const normalized = normalizeValue(value)

    // Skip if empty
    if (!normalized) {
      skippedRows.push({
        row,
        reason: 'empty_primary_key',
        value: value || ''
      })
      return
    }

    // Skip if duplicate
    if (duplicates.has(normalized)) {
      skippedRows.push({
        row,
        reason: 'duplicate',
        value: value
      })
      return
    }

    // Include in insert
    rowsToInsert.push(row)
  })

  return { rowsToInsert, skippedRows }
}

