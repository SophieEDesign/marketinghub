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

  const stringValue = String(value).trim()
  if (stringValue === '') {
    return 'text'
  }

  // Check for boolean first (most specific)
  const lowerValue = stringValue.toLowerCase()
  const booleanValues = ['true', 'false', 'yes', 'no', 'y', 'n', '1', '0', 't', 'f']
  if (booleanValues.includes(lowerValue)) {
    return 'boolean'
  }

  // Check for date (try parsing first, then check patterns)
  // Try parsing as date first - Date constructor is quite flexible
  const date = new Date(stringValue)
  if (!isNaN(date.getTime())) {
    // Additional validation: check if it's a reasonable date (not epoch 0 or far future)
    const year = date.getFullYear()
    if (year >= 1900 && year <= 2100) {
      // Check if the input looks like a date (has numbers and separators)
      const datePatterns = [
        /^\d{4}[-\/]\d{1,2}[-\/]\d{1,2}/, // YYYY-MM-DD or YYYY/MM/DD
        /^\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}/, // MM/DD/YYYY or DD-MM-YYYY
        /^\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i, // DD Mon YYYY
        /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}/i, // Mon DD
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/, // ISO datetime
      ]
      
      // If it matches a date pattern OR if it's a valid date and contains date-like characters
      if (datePatterns.some(pattern => pattern.test(stringValue)) || 
          (/\d{1,2}[-\/\s]\d{1,2}[-\/\s]\d{2,4}/.test(stringValue) && stringValue.length <= 50)) {
        return 'date'
      }
    }
  }

  // Check for number - improved detection
  // Remove common formatting characters (commas, currency symbols, spaces, percent signs)
  const cleanedValue = stringValue.replace(/[$€£¥,\s%]/g, '')
  
  // Check if it's a valid number after cleaning
  if (cleanedValue !== '' && !isNaN(Number(cleanedValue)) && isFinite(Number(cleanedValue))) {
    // Additional check: make sure it's not just text that happens to parse as a number
    // (e.g., "NaN", "Infinity" would pass the above check)
    const numValue = Number(cleanedValue)
    if (isFinite(numValue) && !isNaN(numValue)) {
      // Check if original value contains mostly numeric characters
      const numericChars = stringValue.replace(/[^0-9.-]/g, '').length
      const totalChars = stringValue.length
      
      // If at least 50% of characters are numeric, or if it's a simple number
      if (numericChars / totalChars >= 0.5 || /^-?\d+(\.\d+)?$/.test(cleanedValue)) {
        return 'number'
      }
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

  const total = nonEmptyValues.length
  
  // Use a lower threshold (40%) and prefer more specific types
  // This allows for some mixed data but still detects the dominant type
  const threshold = 0.4

  // Prefer more specific types first (date > boolean > number > text)
  if (typeCounts.date > 0 && typeCounts.date / total >= threshold) {
    return 'date'
  }
  if (typeCounts.boolean > 0 && typeCounts.boolean / total >= threshold) {
    return 'boolean'
  }
  if (typeCounts.number > 0 && typeCounts.number / total >= threshold) {
    return 'number'
  }

  // If no type meets threshold, use the most common type
  const maxCount = Math.max(typeCounts.date, typeCounts.boolean, typeCounts.number, typeCounts.text)
  if (typeCounts.date === maxCount && maxCount > 0) return 'date'
  if (typeCounts.boolean === maxCount && maxCount > 0) return 'boolean'
  if (typeCounts.number === maxCount && maxCount > 0) return 'number'

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
