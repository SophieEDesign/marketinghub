import Papa from 'papaparse'

// Ensure Papa is available
if (typeof window !== 'undefined' && !window.Papa) {
  // @ts-ignore
  window.Papa = Papa
}

export interface ParsedColumn {
  name: string
  sanitizedName: string
  type: 'text' | 'number' | 'boolean' | 'date'
  sampleValues: any[]
}

export interface ParsedCSV {
  columns: ParsedColumn[]
  rows: Record<string, any>[]
  previewRows: Record<string, any>[]
}

/**
 * Infer field type from a value
 */
function inferType(value: any): 'text' | 'number' | 'boolean' | 'date' {
  if (value === null || value === undefined || value === '') {
    return 'text' // Default to text for empty values
  }

  // Check for boolean
  const stringValue = String(value).toLowerCase().trim()
  if (stringValue === 'true' || stringValue === 'false' || stringValue === '1' || stringValue === '0') {
    return 'boolean'
  }

  // Check for number
  if (!isNaN(Number(value)) && value !== '' && !isNaN(parseFloat(value))) {
    // Make sure it's not just whitespace
    if (String(value).trim() === String(Number(value))) {
      return 'number'
    }
  }

  // Check for date (ISO format or common date formats)
  const datePatterns = [
    /^\d{4}-\d{2}-\d{2}$/, // YYYY-MM-DD
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/, // ISO datetime
    /^\d{2}\/\d{2}\/\d{4}$/, // MM/DD/YYYY
    /^\d{2}-\d{2}-\d{4}$/, // MM-DD-YYYY
  ]
  
  const dateStr = String(value).trim()
  if (datePatterns.some(pattern => pattern.test(dateStr))) {
    const date = new Date(dateStr)
    if (!isNaN(date.getTime())) {
      return 'date'
    }
  }

  return 'text'
}

/**
 * Infer column type from multiple sample values
 */
function inferColumnType(values: any[]): 'text' | 'number' | 'boolean' | 'date' {
  const nonEmptyValues = values.filter(v => v !== null && v !== undefined && v !== '')
  
  if (nonEmptyValues.length === 0) {
    return 'text' // Default to text if all empty
  }

  // Count type occurrences
  const typeCounts = {
    text: 0,
    number: 0,
    boolean: 0,
    date: 0,
  }

  nonEmptyValues.forEach(value => {
    const type = inferType(value)
    typeCounts[type]++
  })

  // Return the most common type, but prefer more specific types
  if (typeCounts.date > 0 && typeCounts.date / nonEmptyValues.length > 0.5) {
    return 'date'
  }
  if (typeCounts.boolean > 0 && typeCounts.boolean / nonEmptyValues.length > 0.5) {
    return 'boolean'
  }
  if (typeCounts.number > 0 && typeCounts.number / nonEmptyValues.length > 0.5) {
    return 'number'
  }

  return 'text'
}

/**
 * Sanitize column name for use in database
 */
export function sanitizeColumnName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .substring(0, 63) // PostgreSQL identifier limit
}

/**
 * Sanitize table name
 */
export function sanitizeTableName(name: string): string {
  const sanitized = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .substring(0, 63)
  
  // Ensure it starts with a letter
  if (sanitized && /^[0-9]/.test(sanitized)) {
    return `table_${sanitized}`
  }
  
  return sanitized || 'imported_table'
}

/**
 * Parse CSV file and infer types
 */
export async function parseCSV(file: File): Promise<ParsedCSV> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
      complete: (results) => {
        try {
          const data = results.data as Record<string, any>[]
          
          if (data.length === 0) {
            reject(new Error('CSV file is empty or has no data rows'))
            return
          }

          // Get all column names from first row
          const firstRow = data[0]
          const columnNames = Object.keys(firstRow)
          
          if (columnNames.length === 0) {
            reject(new Error('CSV file has no columns'))
            return
          }

          if (columnNames.length > 200) {
            reject(new Error('CSV file has more than 200 columns. Maximum allowed is 200.'))
            return
          }

          // Analyze each column
          const columns: ParsedColumn[] = columnNames.map((name, index) => {
            const sanitizedName = sanitizeColumnName(name)
            
            // Get sample values from first 100 rows
            const sampleValues = data
              .slice(0, 100)
              .map(row => row[name])
              .filter(v => v !== null && v !== undefined && v !== '')
            
            const type = inferColumnType(
              data.slice(0, 100).map(row => row[name])
            )

            return {
              name: name.trim(),
              sanitizedName,
              type,
              sampleValues: sampleValues.slice(0, 5), // Keep first 5 for preview
            }
          })

          // Get preview rows (first 10)
          const previewRows = data.slice(0, 10)

          resolve({
            columns,
            rows: data,
            previewRows,
          })
        } catch (error: any) {
          reject(new Error(`Failed to parse CSV: ${error.message}`))
        }
      },
      error: (error) => {
        reject(new Error(`CSV parsing error: ${error.message}`))
      },
    })
  })
}
