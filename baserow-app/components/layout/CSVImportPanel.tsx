"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Upload, FileText, Check, ArrowRight, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { supabase } from "@/lib/supabase/client"
import type { TableField, FieldType } from "@/types/fields"
import { FIELD_TYPES } from "@/types/fields"
import { sanitizeFieldName, formatFieldNameForDisplay } from "@/lib/fields/validation"
import { getFieldDisplayName } from "@/lib/fields/display"
import { RESERVED_WORDS } from "@/types/fields"
import { normalizeValue, checkDuplicates, filterDuplicateRows } from "@/lib/import/duplicateDetection"
import ImportSummaryModal from "@/components/import/ImportSummaryModal"
import { getPrimaryFieldName } from "@/lib/fields/primary"

/**
 * Sanitize field name and handle reserved words
 */
function sanitizeFieldNameSafe(name: string): string {
  let sanitized = sanitizeFieldName(name)
  
  // If sanitized name is a reserved word, add suffix
  if (RESERVED_WORDS.includes(sanitized.toLowerCase())) {
    sanitized = `${sanitized}_field`
  }
  
  return sanitized
}

/**
 * Validate if a string is a valid UUID format
 */
function isValidUUID(value: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return uuidRegex.test(value.trim())
}

/**
 * Parse date from CSV value, handling various formats including dd/mm/yyyy
 */
function parseDateFromCSV(value: string): Date | null {
  if (!value || typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  // Try explicit dd/mm/yyyy format first (most common in CSV)
  const ddMMyyyyMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?$/)
  if (ddMMyyyyMatch) {
    const day = parseInt(ddMMyyyyMatch[1], 10)
    const month = parseInt(ddMMyyyyMatch[2], 10) - 1 // Month is 0-indexed
    const year = parseInt(ddMMyyyyMatch[3], 10)
    
    if (day >= 1 && day <= 31 && month >= 0 && month <= 11 && year >= 1900 && year <= 2100) {
      const date = new Date(year, month, day)
      // Verify the date is valid (handles invalid dates like 31/02/2024)
      if (date.getFullYear() === year && date.getMonth() === month && date.getDate() === day) {
        return date
      }
    }
  }

  // Try yyyy-mm-dd format (ISO date)
  const yyyyMMddMatch = trimmed.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?$/)
  if (yyyyMMddMatch) {
    const year = parseInt(yyyyMMddMatch[1], 10)
    const month = parseInt(yyyyMMddMatch[2], 10) - 1
    const day = parseInt(yyyyMMddMatch[3], 10)
    
    if (day >= 1 && day <= 31 && month >= 0 && month <= 11 && year >= 1900 && year <= 2100) {
      const date = new Date(year, month, day)
      if (date.getFullYear() === year && date.getMonth() === month && date.getDate() === day) {
        return date
      }
    }
  }

  // Try mm/dd/yyyy format (US format)
  const mmDDyyyyMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?$/)
  if (mmDDyyyyMatch) {
    const month = parseInt(mmDDyyyyMatch[1], 10) - 1
    const day = parseInt(mmDDyyyyMatch[2], 10)
    const year = parseInt(mmDDyyyyMatch[3], 10)
    
    // Only use this if it's clearly US format (month > 12 would indicate dd/mm)
    if (parseInt(mmDDyyyyMatch[1], 10) <= 12 && day >= 1 && day <= 31 && month >= 0 && month <= 11 && year >= 1900 && year <= 2100) {
      const date = new Date(year, month, day)
      if (date.getFullYear() === year && date.getMonth() === month && date.getDate() === day) {
        return date
      }
    }
  }

  // Try ISO datetime format
  if (trimmed.includes('T') || trimmed.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)) {
    const date = new Date(trimmed)
    if (!isNaN(date.getTime())) {
      const year = date.getFullYear()
      if (year >= 1900 && year <= 2100) {
        return date
      }
    }
  }

  // Try text date formats (e.g., "01 Jan 2024", "Jan 01, 2024")
  const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
  const textDateMatch = trimmed.match(/(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{4})/i)
  if (textDateMatch) {
    const day = parseInt(textDateMatch[1], 10)
    const monthName = textDateMatch[2].toLowerCase()
    const year = parseInt(textDateMatch[3], 10)
    const month = monthNames.indexOf(monthName)
    
    if (month >= 0 && day >= 1 && day <= 31 && year >= 1900 && year <= 2100) {
      const date = new Date(year, month, day)
      if (date.getFullYear() === year && date.getMonth() === month && date.getDate() === day) {
        return date
      }
    }
  }

  // Fallback to native Date parsing (but validate result)
  const date = new Date(trimmed)
  if (!isNaN(date.getTime())) {
    const year = date.getFullYear()
    // Only accept if it's a reasonable date and the input looks date-like
    if (year >= 1900 && year <= 2100 && /\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/.test(trimmed)) {
      return date
    }
  }

  return null
}

interface CSVImportPanelProps {
  tableId: string
  tableName: string
  supabaseTableName: string
  onImportComplete: () => void
}

type ImportStep = "upload" | "mapping" | "preview" | "importing" | "complete"

interface CSVRow {
  [key: string]: string
}

export default function CSVImportPanel({
  tableId,
  tableName,
  supabaseTableName,
  onImportComplete,
}: CSVImportPanelProps) {
  const router = useRouter()
  const [step, setStep] = useState<ImportStep>("upload")
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [csvRows, setCsvRows] = useState<CSVRow[]>([])
  const [tableFields, setTableFields] = useState<TableField[]>([])
  const [fieldMappings, setFieldMappings] = useState<Record<string, string>>({})
  const [newFields, setNewFields] = useState<Record<string, FieldType>>({})
  const [importedCount, setImportedCount] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [showSummary, setShowSummary] = useState(false)
  const [importSummary, setImportSummary] = useState<{
    totalRows: number
    importedRows: number
    skippedRows: number
    primaryKeyField: string
    skippedDetails: Array<{ row: Record<string, any>; reason: string; value: any }>
  } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load table fields and verify table exists
  useEffect(() => {
    loadFields()
    verifyTableExists()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableId, supabaseTableName])

  async function verifyTableExists() {
    try {
      const { error: tableCheckError } = await supabase
        .from(supabaseTableName)
        .select('id')
        .limit(1)
      
      if (tableCheckError) {
        if (tableCheckError.code === '42P01' || tableCheckError.code === 'PGRST116' || tableCheckError.message?.includes('does not exist')) {
          setError(
            `Table "${supabaseTableName}" does not exist. ` +
            `The table may have been deleted. Please create a new table or use the "Import CSV" feature to create a new table from your CSV file.`
          )
        }
      }
    } catch (error) {
      console.error("Error verifying table exists:", error)
    }
  }

  async function loadFields() {
    try {
      const response = await fetch(`/api/tables/${tableId}/fields`)
      const data = await response.json()
      if (data.fields) {
        setTableFields(data.fields)
      }
    } catch (error) {
      console.error("Error loading fields:", error)
    }
  }

  function parseCSV(text: string): { headers: string[]; rows: CSVRow[] } {
    const lines = text.split("\n").filter(line => line.trim())
    if (lines.length === 0) return { headers: [], rows: [] }

    // Simple CSV parser (handles quoted fields)
    function parseLine(line: string): string[] {
      const result: string[] = []
      let current = ""
      let inQuotes = false

      for (let i = 0; i < line.length; i++) {
        const char = line[i]
        if (char === '"') {
          inQuotes = !inQuotes
        } else if (char === "," && !inQuotes) {
          result.push(current.trim())
          current = ""
        } else {
          current += char
        }
      }
      result.push(current.trim())
      return result
    }

    const headers = parseLine(lines[0])
    const rows: CSVRow[] = []

    // Parse first 10 rows for preview
    for (let i = 1; i < Math.min(lines.length, 11); i++) {
      const values = parseLine(lines[i])
      const row: CSVRow = {}
      headers.forEach((header, index) => {
        row[header] = values[index] || ""
      })
      rows.push(row)
    }

    return { headers, rows }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setError(null)
    setImportedCount(0) // Reset count at start of import
    
    try {
      const text = await file.text()
      const { headers, rows } = parseCSV(text)

      if (headers.length === 0) {
        setError("CSV file appears to be empty or invalid")
        return
      }

      setCsvHeaders(headers)
      setCsvRows(rows)

      // Auto-map headers to existing fields
      const mappings: Record<string, string> = {}
      const autoDetectedTypes: Record<string, FieldType> = {}
      
      headers.forEach((header) => {
        // First try exact match (case-insensitive)
        let matchingField = tableFields.find(
          (f) => f.name.toLowerCase() === header.toLowerCase()
        )
        
        // If no exact match, try sanitized match (handles "Notes/Detail" -> "notes_detail")
        if (!matchingField) {
          const sanitizedHeader = sanitizeFieldName(header)
          matchingField = tableFields.find(
            (f) => sanitizeFieldName(f.name) === sanitizedHeader
          )
        }
        
        if (matchingField) {
          mappings[header] = matchingField.name
        } else {
          // Auto-detect field type from sample data
          const sampleValues = (Array.isArray(rows) ? rows : []).slice(0, 10).map(row => row[header]).filter(v => v && v.trim())
          if (sampleValues.length > 0) {
            const detectedType = detectFieldType(sampleValues)
            autoDetectedTypes[header] = detectedType
          }
        }
      })
      
      setFieldMappings(mappings)
      // Merge auto-detected types with any existing newFields
      setNewFields((prev) => ({ ...prev, ...autoDetectedTypes }))

      setStep("mapping")
    } catch (err) {
      setError(`Failed to read CSV file: ${(err as Error).message}`)
    }
  }

  // Auto-detect field type from sample values
  // Uses a threshold approach: if >80% of values match a pattern, use that type
  // Requires minimum sample size for more accurate detection
  function detectFieldType(sampleValues: string[]): FieldType {
    if (sampleValues.length === 0) return 'text'
    
    const nonEmptyValues = sampleValues.filter(v => v != null && v.trim() !== '')

    if (nonEmptyValues.length === 0) return 'text'
    
    // Require minimum sample size for accurate detection
    const MIN_SAMPLES = 3
    if (nonEmptyValues.length < MIN_SAMPLES) return 'text'
    
    // Increased threshold to 80% for stricter detection
    const threshold = Math.max(1, Math.ceil(nonEmptyValues.length * 0.8))
    const totalCount = nonEmptyValues.length

    // Check for JSON pattern first (most specific) - at least 80% match
    const jsonPattern = /^[\s]*[{\[]/
    const jsonMatches = nonEmptyValues.filter(v => {
      const trimmed = v.trim()
      if (!jsonPattern.test(trimmed)) return false
      try {
        const parsed = JSON.parse(trimmed)
        // Additional validation: must be object or array
        return typeof parsed === 'object' && parsed !== null
      } catch {
        return false
      }
    }).length
    
    if (jsonMatches >= threshold) {
      return 'json'
    }

    // Check for email pattern (at least 80% match) - stricter validation
    const emailPattern = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/
    const emailMatches = nonEmptyValues.filter(v => {
      const trimmed = v.trim()
      // Must match pattern and have valid domain structure
      return emailPattern.test(trimmed) && trimmed.includes('.') && trimmed.split('@')[1]?.includes('.')
    }).length
    if (emailMatches >= threshold) {
      return 'email'
    }

    // Check for URL pattern (at least 80% match) - stricter detection
    const urlMatches = nonEmptyValues.filter(v => {
      const trimmed = v.trim().toLowerCase()
      // Require explicit protocol (http/https) or www prefix
      if (/^https?:\/\/[^\s]+/.test(trimmed)) {
        // Must have valid domain after protocol
        const domain = trimmed.replace(/^https?:\/\//, '').split('/')[0]
        return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}$/.test(domain)
      }
      // Or require www. prefix with valid domain
      if (/^www\.[^\s]+/.test(trimmed)) {
        const domain = trimmed.replace(/^www\./, '').split('/')[0]
        return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}$/.test(domain)
      }
      return false
    }).length
    if (urlMatches >= threshold) {
      return 'url'
    }

    // Check for boolean/checkbox - at least 80% match, require exact boolean values
    const booleanValues = ['true', 'false', 'yes', 'no', '1', '0']
    const booleanMatches = nonEmptyValues.filter(v => {
      const trimmed = v.toLowerCase().trim()
      // Only accept exact boolean values (removed 'y', 'n', 't', 'f' for stricter detection)
      return booleanValues.includes(trimmed)
    }).length
    if (booleanMatches >= threshold) {
      return 'checkbox'
    }

    // Check for categorical data (single_select or multi_select) BEFORE checking dates/numbers
    // This is important because dates/numbers might match loosely
    const uniqueValues = new Set(nonEmptyValues.map(v => v.trim().toLowerCase()))
    const uniqueCount = uniqueValues.size
    
    // Stricter categorical detection: require more repetition
    // Need at least 5 samples and unique values <= 40% of total OR <= 10 unique values
    if (totalCount >= 5 && (uniqueCount <= Math.max(2, Math.floor(totalCount * 0.4)) || uniqueCount <= 10)) {
      // Check if values contain commas or semicolons (multi-select indicator)
      const multiSelectIndicators = nonEmptyValues.filter(v => 
        /[,;]/.test(v.trim())
      ).length
      
      // Require at least 50% to have separators for multi-select
      if (multiSelectIndicators >= Math.ceil(totalCount * 0.5)) {
        return 'multi_select'
      } else {
        // Likely single-select category (check if values repeat)
        // Count how many times the most common value appears
        const valueCounts = new Map<string, number>()
        nonEmptyValues.forEach(v => {
          const key = v.trim().toLowerCase()
          valueCounts.set(key, (valueCounts.get(key) || 0) + 1)
        })
        const maxCount = Math.max(...Array.from(valueCounts.values()))
        // Require most common value to appear at least 3 times and unique values <= 10
        if (maxCount >= 3 && uniqueCount <= 10) {
          return 'single_select'
        }
      }
    }

    // Check for date pattern (common formats) - at least 80% match, require pattern AND valid parse
    const datePatterns = [
      /^\d{4}[-\/]\d{1,2}[-\/]\d{1,2}$/, // YYYY-MM-DD, YYYY/MM/DD
      /^\d{1,2}[-\/]\d{1,2}[-\/]\d{4}$/, // MM/DD/YYYY, DD-MM-YYYY
      /^\d{1,2}[-\/]\d{1,2}[-\/]\d{4}\s+\d{1,2}:\d{2}(?::\d{2})?/, // MM/DD/YYYY HH:MM or HH:MM:SS
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})?$/, // ISO datetime
      /^\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}$/i, // DD Mon YYYY
      /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}$/i, // Mon DD, YYYY
    ]
    
    // Stricter date detection: require pattern match AND valid parse
    const dateMatches = nonEmptyValues.filter(v => {
      const trimmed = v.trim()
      // Must match a date pattern first
      const matchesPattern = datePatterns.some(p => p.test(trimmed))
      if (!matchesPattern) return false
      
      // Then verify it parses to a valid date
      const date = parseDateFromCSV(trimmed)
      if (!date) return false
      
      // Additional validation: check year is reasonable
      const year = date.getFullYear()
      return year >= 1900 && year <= 2100
    }).length
    
    if (dateMatches >= threshold) {
      return 'date'
    }

    // Check for number (integer or decimal) - at least 80% match, require consistent format
    // Remove currency symbols and percentage signs for number detection
    const cleanedValues = nonEmptyValues.map(v => v.trim().replace(/[$€£¥%,\s]/g, ''))
    const numberPattern = /^-?\d+(\.\d+)?$/
    const numberMatches = cleanedValues.filter(v => {
      // Must match number pattern
      if (!numberPattern.test(v)) return false
      // Additional validation: check it's a valid number
      const num = parseFloat(v)
      return !isNaN(num) && isFinite(num)
    }).length
    
    if (numberMatches >= threshold) {
      // Check if it's a percentage (contains % in original) - require 80% match
      const percentCount = nonEmptyValues.filter(v => {
        const trimmed = v.trim()
        return trimmed.includes('%') && numberPattern.test(trimmed.replace(/[$€£¥%,\s]/g, ''))
      }).length
      if (percentCount >= threshold) {
        return 'percent'
      }
      // Check if it's currency (contains currency symbols) - require 80% match
      const currencyCount = nonEmptyValues.filter(v => {
        const trimmed = v.trim()
        const hasCurrency = /[$€£¥]/.test(trimmed) || trimmed.toLowerCase().includes('usd') || trimmed.toLowerCase().includes('gbp')
        const isNumber = numberPattern.test(trimmed.replace(/[$€£¥%,\s]/g, ''))
        return hasCurrency && isNumber
      }).length
      if (currencyCount >= threshold) {
        return 'currency'
      }
      return 'number'
    }

    // Default to text
    return 'text'
  }


  function handleMappingChange(csvHeader: string, fieldName: string) {
    setFieldMappings((prev) => ({
      ...prev,
      [csvHeader]: fieldName,
    }))
  }

  function handleNewFieldType(csvHeader: string, fieldType: FieldType) {
    setNewFields((prev) => ({
      ...prev,
      [csvHeader]: fieldType,
    }))
  }

  async function handleImport() {
    setStep("importing")
    setError(null)

    try {
      // First, verify the table exists
      const { error: tableCheckError } = await supabase
        .from(supabaseTableName)
        .select('id')
        .limit(1)
      
      if (tableCheckError) {
        if (tableCheckError.code === '42P01' || tableCheckError.code === 'PGRST116' || tableCheckError.message?.includes('does not exist')) {
          throw new Error(
            `Table "${supabaseTableName}" does not exist. ` +
            `The table may have been deleted. Please create a new table or use the "Import CSV" feature to create a new table from your CSV file.`
          )
        }
        // For other errors, continue but log a warning
        console.warn('Table check warning:', tableCheckError)
      }

      // First, create any new fields
      // Parse full CSV to extract choices for select fields
      const file = fileInputRef.current?.files?.[0]
      if (!file) return

      const text = await file.text()
      const lines = text.split("\n").filter(line => line.trim())
      
      function parseLine(line: string): string[] {
        const result: string[] = []
        let current = ""
        let inQuotes = false
        for (let i = 0; i < line.length; i++) {
          const char = line[i]
          if (char === '"') {
            inQuotes = !inQuotes
          } else if (char === "," && !inQuotes) {
            result.push(current.trim())
            current = ""
          } else {
            current += char
          }
        }
        result.push(current.trim())
        return result
      }

      const allHeaders = parseLine(lines[0])
      const allRows: CSVRow[] = []
      for (let i = 1; i < lines.length; i++) {
        const values = parseLine(lines[i])
        const row: CSVRow = {}
        allHeaders.forEach((header, index) => {
          row[header] = values[index] || ""
        })
        allRows.push(row)
      }

      // Refresh fields to ensure we have the latest state (important after previous imports)
      await loadFields()
      const preCheckFieldsResponse = await fetch(`/api/tables/${tableId}/fields?t=${Date.now()}`, {
        cache: 'no-store',
      })
      const preCheckFieldsData = preCheckFieldsResponse.ok ? await preCheckFieldsResponse.json() : { fields: [] }
      const preCheckFields = preCheckFieldsData.fields || []
      setTableFields(preCheckFields)
      
      const fieldsToCreate: Array<{ name: string; type: FieldType; options?: any }> = []
      const autoMappedFields: Record<string, string> = {} // CSV header -> existing field name
      
      csvHeaders.forEach((header) => {
        if (!fieldMappings[header] && newFields[header]) {
          // Before creating, check if field already exists
          const sanitizedHeader = sanitizeFieldNameSafe(header)
          
          // Try exact match
          let existingField = preCheckFields.find((f: TableField) => f.name.toLowerCase() === sanitizedHeader.toLowerCase())
          
          // Try sanitized match
          if (!existingField) {
            existingField = preCheckFields.find((f: TableField) => 
              sanitizeFieldNameSafe(f.name).toLowerCase() === sanitizedHeader.toLowerCase()
            )
          }
          
          // If field exists, map to it instead of creating
          if (existingField) {
            autoMappedFields[header] = existingField.name
            console.log(`Field "${header}" already exists as "${existingField.name}", auto-mapping to existing field`)
            return // Skip creation
          }
          
          const fieldType = newFields[header]
          const fieldData: { name: string; type: FieldType; options?: any } = {
            name: header,
            type: fieldType,
          }

          // Extract choices for select fields
          if (fieldType === 'single_select' || fieldType === 'multi_select') {
            const uniqueChoices = new Set<string>()
            allRows.forEach(row => {
              const value = row[header]
              if (value && value.trim()) {
                if (fieldType === 'multi_select') {
                  // Split by comma or semicolon for multi-select
                  const parts = value.split(/[,;]/).map(p => p.trim()).filter(p => p)
                  parts.forEach(part => uniqueChoices.add(part))
                } else {
                  uniqueChoices.add(value.trim())
                }
              }
            })
            
            // Convert to sorted array and limit to reasonable number
            const choices = Array.from(uniqueChoices).sort().slice(0, 100)
            if (choices.length > 0) {
              fieldData.options = { choices }
            }
          }

          fieldsToCreate.push(fieldData)
        }
      })
      
      // Create new fields and wait for them to be created
      const createdFieldNames: Record<string, string> = {} // Maps CSV header to sanitized field name
      const createdFieldsInfo: Record<string, { name: string; type: FieldType; options?: any }> = {} // Maps sanitized name to field info
      
      // Refresh fields one more time right before creating to catch any that were created concurrently
      const preCreateFieldsResponse = await fetch(`/api/tables/${tableId}/fields?t=${Date.now()}`, {
        cache: 'no-store',
      })
      const preCreateFieldsData = preCreateFieldsResponse.ok ? await preCreateFieldsResponse.json() : { fields: [] }
      const preCreateFields = preCreateFieldsData.fields || []
      
      for (const fieldData of fieldsToCreate) {
        // Calculate what the sanitized name will be (matching API logic)
        const expectedSanitizedName = sanitizeFieldNameSafe(fieldData.name)
        
        // Double-check field doesn't already exist before creating
        // Check multiple ways: exact match, sanitized match, case-insensitive
        let existingField = preCreateFields.find((f: TableField) => 
          f.name.toLowerCase() === expectedSanitizedName.toLowerCase() ||
          sanitizeFieldNameSafe(f.name).toLowerCase() === expectedSanitizedName.toLowerCase() ||
          f.name.toLowerCase() === fieldData.name.toLowerCase()
        )
        
        if (existingField) {
          // Field already exists - map to it instead of creating
          console.log(`Field "${fieldData.name}" (would be sanitized to "${expectedSanitizedName}") already exists as "${existingField.name}", mapping to existing field`)
          createdFieldNames[fieldData.name] = existingField.name
          createdFieldsInfo[existingField.name] = {
            name: existingField.name,
            type: existingField.type,
            options: existingField.options || {},
          }
          continue // Skip creation, move to next field
        }
        
        // Send original name to API - it will sanitize consistently
        // The API will return the actual sanitized field name in the response
        const response = await fetch(`/api/tables/${tableId}/fields`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(fieldData), // fieldData.name is the original name
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
          const errorMessage = errorData.error || 'Unknown error'
          
          // Check if error is due to field already existing
          if (errorMessage.includes('already exists') || errorMessage.includes('duplicate') || errorMessage.includes('unique')) {
            // Field was created concurrently - reload fields and try to map to existing
            console.warn(`Field "${fieldData.name}" already exists (likely created concurrently), reloading fields...`)
            const retryFieldsResponse = await fetch(`/api/tables/${tableId}/fields?t=${Date.now()}`, {
              cache: 'no-store',
            })
            const retryFieldsData = retryFieldsResponse.ok ? await retryFieldsResponse.json() : { fields: [] }
            const retryFields = retryFieldsData.fields || []
            
            const foundField = retryFields.find((f: TableField) => 
              f.name.toLowerCase() === expectedSanitizedName.toLowerCase() ||
              sanitizeFieldNameSafe(f.name).toLowerCase() === expectedSanitizedName.toLowerCase()
            )
            
            if (foundField) {
              console.log(`Found existing field "${foundField.name}", mapping to it`)
              createdFieldNames[fieldData.name] = foundField.name
              createdFieldsInfo[foundField.name] = {
                name: foundField.name,
                type: foundField.type,
                options: foundField.options || {},
              }
              continue // Skip creation, already mapped
            }
          }
          
          throw new Error(`Failed to create field "${fieldData.name}": ${errorMessage}`)
        }
        
        // Get the created field data to know the exact sanitized name
        const createdField = await response.json().catch(() => null)
        let actualSanitizedName: string
        
        if (createdField?.field?.name) {
          // API returns { field: { name: "...", type: "...", ... } }
          actualSanitizedName = createdField.field.name
          createdFieldNames[fieldData.name] = actualSanitizedName
          // Store full field info including type for immediate use
          createdFieldsInfo[actualSanitizedName] = {
            name: actualSanitizedName,
            type: fieldData.type,
            options: fieldData.options,
          }
        } else if (createdField?.name) {
          // Sometimes API might return field directly
          actualSanitizedName = createdField.name
          createdFieldNames[fieldData.name] = actualSanitizedName
          createdFieldsInfo[actualSanitizedName] = {
            name: actualSanitizedName,
            type: fieldData.type,
            options: fieldData.options,
          }
        } else {
          // Fallback: sanitize the name ourselves (should match API)
          actualSanitizedName = sanitizeFieldNameSafe(fieldData.name)
          createdFieldNames[fieldData.name] = actualSanitizedName
          createdFieldsInfo[actualSanitizedName] = {
            name: actualSanitizedName,
            type: fieldData.type,
            options: fieldData.options,
          }
          console.warn(`Field creation response format unexpected for "${fieldData.name}", using sanitized name: ${actualSanitizedName}`)
        }
      }

      // Wait for fields to be available - retry with exponential backoff
      // Supabase schema cache can take a moment to refresh
      await new Promise(resolve => setTimeout(resolve, 1000)) // Initial wait
      await loadFields()
      
      // Fetch updated fields multiple times to ensure we have the latest
      let updatedFields: TableField[] = []
      let allFieldsVerified = false
      
      for (let attempt = 0; attempt < 10; attempt++) {
        const updatedFieldsResponse = await fetch(`/api/tables/${tableId}/fields?t=${Date.now()}`, {
          cache: 'no-store', // Bypass cache
        })
        if (updatedFieldsResponse.ok) {
          const data = await updatedFieldsResponse.json()
          updatedFields = data.fields || []
          
          // Verify all created fields are present
          const createdFieldNamesList = Object.values(createdFieldNames)
          const allCreatedFieldsFound = createdFieldNamesList.length === 0 || createdFieldNamesList.every(sanitizedName => 
            updatedFields.some((f: TableField) => f.name === sanitizedName)
          )
          
          if (updatedFields.length > 0 && (createdFieldNamesList.length === 0 || allCreatedFieldsFound)) {
            allFieldsVerified = true
            console.log(`All ${createdFieldNamesList.length} created fields verified after ${attempt + 1} attempt(s)`)
            break
          }
        }
        
        if (attempt < 9) {
          // Exponential backoff: 500ms, 1000ms, 1500ms, etc.
          await new Promise(resolve => setTimeout(resolve, 500 + (attempt * 500)))
        }
      }
      
      if (updatedFields.length === 0) {
        throw new Error('No fields found in table. Please ensure the table has at least one field.')
      }
      
      if (!allFieldsVerified && fieldsToCreate.length > 0) {
        console.warn('Not all created fields were found after retries, but proceeding with stored field info')
      }
      
      // Build a comprehensive field map: use created fields first, then fall back to loaded fields
      const fieldMap = new Map<string, TableField>()
      
      // Add all loaded fields
      updatedFields.forEach((f: TableField) => {
        fieldMap.set(f.name, f)
      })
      
      // Override/add created fields with their info (in case they're not in updatedFields yet)
      Object.entries(createdFieldsInfo).forEach(([fieldName, fieldInfo]) => {
        if (!fieldMap.has(fieldName)) {
          // Create a TableField-like object from the creation response
          fieldMap.set(fieldName, {
            id: '', // Not needed for type conversion
            name: fieldInfo.name,
            type: fieldInfo.type,
            position: 0,
            required: false,
            options: fieldInfo.options || {},
          } as TableField)
        }
      })
      
      // Build comprehensive field mapping: merge original mappings, auto-mapped fields, and created fields
      const allFieldMappings: Record<string, string> = { ...fieldMappings, ...autoMappedFields }
      
      // Add created field names to mappings
      Object.entries(createdFieldNames).forEach(([csvHeader, fieldName]) => {
        allFieldMappings[csvHeader] = fieldName
      })
      
      // Log created field mappings for debugging
      console.log('Created field mappings:', createdFieldNames)
      console.log('Auto-mapped fields:', autoMappedFields)
      console.log('All field mappings:', allFieldMappings)
      console.log('Available fields:', updatedFields.map((f: TableField) => f.name))
      console.log('Field map size:', fieldMap.size, 'Fields in map:', Array.from(fieldMap.keys()))

      // Use already parsed CSV data (allRows was created above)

      // Check for unmapped headers (warn but don't block - they'll be skipped)
      const unmappedHeaders = csvHeaders.filter(header => {
        return !allFieldMappings[header] && !newFields[header]
      })

      if (unmappedHeaders.length > 0) {
        console.warn(`Skipping unmapped CSV columns: ${unmappedHeaders.join(', ')}`)
      }

      // Ensure at least one column is mapped
      const mappedHeaders = csvHeaders.filter(header => {
        return allFieldMappings[header] || newFields[header]
      })

      if (mappedHeaders.length === 0) {
        throw new Error(
          `No CSV columns are mapped to fields. Please map at least one column to an existing field or create a new field for it.`
        )
      }

      // Map and insert rows - only include columns that exist in the table
      console.log(`📊 Mapping ${allRows.length} CSV rows to database format`)
      console.log(`📋 CSV headers:`, csvHeaders)
      console.log(`🗺️ Mapped headers:`, mappedHeaders)
      console.log(`📝 All field mappings:`, allFieldMappings)
      console.log(`🆕 New fields:`, newFields)
      console.log(`📑 Updated fields:`, updatedFields.map((f: TableField) => ({ name: f.name, type: f.type })))
      
      const rowsToInsert = allRows.map((csvRow, rowIndex) => {
        const mappedRow: Record<string, any> = {}
        let fieldsAdded = 0
        
        csvHeaders.forEach((csvHeader) => {
          // Determine the field name: either from mapping or from new field creation
          // When a new field is created, it uses the CSV header name (sanitized)
          const mappedFieldName = allFieldMappings[csvHeader]
          const isNewField = !mappedFieldName && newFields[csvHeader]
          
          // Skip if this column is not mapped and not a new field
          if (!mappedFieldName && !isNewField) {
            return // Skip unmapped columns
          }
          
          // Find the field - either by mapped name or by CSV header name (for new fields)
          let field: TableField | undefined
          let fieldNameToUse: string | undefined
          
          if (mappedFieldName) {
            fieldNameToUse = mappedFieldName
            field = fieldMap.get(mappedFieldName)
          } else if (isNewField) {
            // For new fields, use the sanitized name we tracked during creation
            const sanitizedFieldName = createdFieldNames[csvHeader] || sanitizeFieldNameSafe(csvHeader)
            fieldNameToUse = sanitizedFieldName
            field = fieldMap.get(sanitizedFieldName)
            
            // If still not found, try case-insensitive match as fallback
            if (!field) {
              for (const [mapFieldName, mapField] of fieldMap.entries()) {
                if (mapFieldName.toLowerCase() === sanitizedFieldName.toLowerCase()) {
                  field = mapField
                  fieldNameToUse = mapFieldName
                  break
                }
              }
            }
          }
          
          // If still not found, this is a critical error
          if (!field || !fieldNameToUse) {
            const attemptedName = mappedFieldName || createdFieldNames[csvHeader] || sanitizeFieldNameSafe(csvHeader)
            const availableFields = Array.from(fieldMap.keys()).join(', ')
            throw new Error(
              `Field "${attemptedName}" (from CSV column "${csvHeader}") was not found in the field map. ` +
              `This may be a schema cache issue. Please try again in a few seconds. ` +
              `Available fields in map: ${availableFields || 'none'}`
            )
          }

          let value: any = csvRow[csvHeader]
          
          // Convert empty strings to null for consistency
          if (value === '' || value === null || value === undefined) {
            value = null
          }
          
          // Type conversion based on field type
          if (value === null || value === undefined || value === '') {
            // Handle null/empty values based on field type
            if (field.type === "checkbox") {
              value = false
            } else if (field.type === "multi_select") {
              value = []
            } else {
              value = null
            }
          } else {
            // Perform type conversion for non-null values
            if (field.type === "number" || field.type === "currency" || field.type === "percent") {
              value = parseFloat(value) || 0
            } else if (field.type === "checkbox") {
              value = (String(value).toLowerCase() === "true" || value === "1" || String(value).toLowerCase() === "yes")
            } else if (field.type === "date") {
              // Parse date using robust parser that handles dd/mm/yyyy and other formats
              const date = parseDateFromCSV(String(value))
              if (date) {
                // Return ISO string for timestamptz
                value = date.toISOString()
              } else {
                value = null
              }
            } else if (field.type === "multi_select") {
              // Convert comma/semicolon-separated values to array
              const parts = String(value).split(/[,;]/).map(p => p.trim()).filter(p => p)
              value = parts
            } else if (field.type === "single_select") {
              // Single select is just a string
              value = String(value).trim()
            } else if (field.type === "link_to_table") {
              // Link to table fields require valid UUID values
              const stringValue = String(value).trim()
              if (stringValue && isValidUUID(stringValue)) {
                value = stringValue
              } else {
                // Invalid UUID - set to null (skip this field for this row)
                // Log warning for debugging but don't fail the entire import
                if (stringValue) {
                  console.warn(
                    `Skipping invalid UUID value "${stringValue}" for link_to_table field "${fieldNameToUse}" in row ${rowIndex + 1}. ` +
                    `Expected a valid UUID format (e.g., "550e8400-e29b-41d4-a716-446655440000").`
                  )
                }
                value = null
              }
            } else {
              // For text fields, convert to string
              value = String(value).trim()
            }
          }
          
          // Use fieldNameToUse which should match the sanitized column name in Supabase
          // Field names are sanitized when created, so they match column names
          mappedRow[fieldNameToUse] = value
          fieldsAdded++
        })
        
        // Log first few rows for debugging
        if (rowIndex < 3) {
          console.log(`Row ${rowIndex + 1}: added ${fieldsAdded} fields, keys:`, Object.keys(mappedRow))
          if (rowIndex === 0) {
            console.log(`Sample mapped row:`, mappedRow)
          }
        }
        
        return mappedRow
      }).filter(row => {
        // Filter out completely empty rows, but log them for debugging
        const isEmpty = Object.keys(row).length === 0
        if (isEmpty) {
          console.warn('Filtered out empty row:', row)
        }
        return !isEmpty
      })

      console.log(`Prepared ${rowsToInsert.length} rows to insert (from ${allRows.length} CSV rows)`)
      
      // Validate we have rows to insert
      if (rowsToInsert.length === 0) {
        const mappedCount = mappedHeaders.length
        const sampleRow = allRows[0] || {}
        const sampleValues = csvHeaders.map(h => `${h}: "${sampleRow[h]}"`).join(', ')
        
        throw new Error(
          `No valid rows to import. ` +
          `Total CSV rows: ${allRows.length}, ` +
          `Mapped columns: ${mappedCount}/${csvHeaders.length}. ` +
          `Sample row values: ${sampleValues}. ` +
          `Please ensure at least one column is mapped and contains data.`
        )
      }

      // Duplicate Detection
      // Use the table's primary field for duplicate detection (core data)
      const primaryKeyField = getPrimaryFieldName(tableFields)
      if (!primaryKeyField) {
        throw new Error('This table has no fields. Create a primary field first, then re-try the import.')
      }
      const isPrimaryFieldMapped = Object.values(allFieldMappings).some((mapped) => mapped === primaryKeyField)
      if (!isPrimaryFieldMapped) {
        throw new Error(
          `The table primary field "${primaryKeyField}" must be mapped for duplicate detection. ` +
          `Please map a CSV column to "${primaryKeyField}" (or rename a column to match it).`
        )
      }

      setStep("importing")
      setError(null)
      // Note: CSVImportPanel doesn't have a progress state, so we'll just proceed

      // Extract and normalize primary key values from CSV
      const csvPrimaryKeyValues = rowsToInsert.map(row => {
        const value = row[primaryKeyField]
        return normalizeValue(value)
      })

      // Check for duplicates in database
      const duplicates = await checkDuplicates(
        supabase,
        supabaseTableName,
        primaryKeyField,
        csvPrimaryKeyValues
      )

      // Filter out duplicate rows
      const { rowsToInsert: filteredRows, skippedRows } = filterDuplicateRows(
        rowsToInsert,
        primaryKeyField,
        duplicates
      )

      if (filteredRows.length === 0) {
        // All rows are duplicates or have empty keys
        setImportSummary({
          totalRows: allRows.length,
          importedRows: 0,
          skippedRows: skippedRows.length,
          primaryKeyField,
          skippedDetails: skippedRows,
        })
        setShowSummary(true)
        setStep("complete")
        return
      }

      // Insert in batches
      const batchSize = 100
      let imported = 0
      console.log(`Starting batch insert: ${filteredRows.length} rows in ${Math.ceil(filteredRows.length / batchSize)} batches (${skippedRows.length} skipped)`)
      console.log(`Supabase table: ${supabaseTableName}`)
      console.log(`First row sample:`, filteredRows[0])
      
      for (let i = 0; i < filteredRows.length; i += batchSize) {
        const batch = filteredRows.slice(i, i + batchSize)
        const batchNum = Math.floor(i / batchSize) + 1
        const totalBatches = Math.ceil(rowsToInsert.length / batchSize)
        
        // Safety check: ensure batch is not empty
        if (batch.length === 0) {
          console.warn(`Skipping empty batch ${batchNum}`)
          continue
        }
        
        console.log(`Inserting batch ${batchNum}/${totalBatches}, rows ${i + 1}-${Math.min(i + batchSize, rowsToInsert.length)}`)
        console.log(`Batch size: ${batch.length}, keys:`, Object.keys(batch[0] || {}))
        
        const { error, data } = await supabase
          .from(supabaseTableName)
          .insert(batch)
          .select()

        if (error) {
          console.error("Error inserting batch:", error)
          console.error("Batch size:", batch.length)
          console.error("Batch keys (first row):", Object.keys(batch[0] || {}))
          console.error("Batch sample (first row):", JSON.stringify(batch[0], null, 2))
          console.error("Supabase table name:", supabaseTableName)
          console.error("Available fields:", updatedFields.map((f: TableField) => f.name))
          
          // Provide more helpful error message for column errors
          if (error.message?.includes('column') || error.code === '42703' || error.code === '42P01' || error.code === 'PGRST116') {
            const columnMatch = error.message?.match(/column ['"]([^'"]+)['"]/) || 
                               error.message?.match(/Could not find a relationship between ['"]([^'"]+)['"]/)
            const columnName = columnMatch ? columnMatch[1] : 'unknown'
            const batchKeys = Object.keys(batch[0] || {})
            throw new Error(
              `Column "${columnName}" does not exist in table "${supabaseTableName}". ` +
              `Batch is trying to insert columns: ${batchKeys.join(', ')}. ` +
              `Available fields: ${updatedFields.map((f: TableField) => f.name).join(', ')}. ` +
              `Please ensure field names match column names. ` +
              `Original error: ${error.message || JSON.stringify(error)}`
            )
          }
          
          // Check for null constraint violations
          if (error.message?.includes('null value') || error.code === '23502') {
            throw new Error(
              `Required field is missing data. Please ensure all required fields have values in your CSV. ` +
              `Error: ${error.message}`
            )
          }
          
          // Check for foreign key violations
          if (error.code === '23503') {
            throw new Error(
              `Foreign key constraint violation. Please check that referenced records exist. ` +
              `Error: ${error.message}`
            )
          }
          
          // Check for UUID format errors
          if (error.message?.includes('invalid input syntax for type uuid') || error.code === '22P02') {
            const uuidMatch = error.message?.match(/invalid input syntax for type uuid: "([^"]+)"/)
            const invalidValue = uuidMatch ? uuidMatch[1] : 'unknown'
            
            // Find which field might be causing this
            const linkToTableFields = updatedFields.filter((f: TableField) => f.type === 'link_to_table')
            const fieldNames = linkToTableFields.map((f: TableField) => f.name).join(', ')
            
            throw new Error(
              `Invalid UUID value "${invalidValue}" found in CSV data. ` +
              `This value is being inserted into a "Link to table" field, which requires a valid UUID format. ` +
              `Link to table fields in this table: ${fieldNames || 'none found'}. ` +
              `Please ensure CSV values for link_to_table fields are valid UUIDs (e.g., "550e8400-e29b-41d4-a716-446655440000"). ` +
              `If you're trying to link by name or other identifier, you'll need to first look up the UUID of the related record. ` +
              `Original error: ${error.message}`
            )
          }
          
          throw new Error(`Failed to insert rows: ${error.message || JSON.stringify(error)}`)
        }

        imported += batch.length
        setImportedCount(imported)
        console.log(`✅ Successfully imported batch ${batchNum}/${totalBatches}: ${batch.length} rows (total: ${imported}/${filteredRows.length})`)
      }

      // Only set complete if we actually imported something
      if (imported > 0) {
        // Show import summary
        setImportSummary({
          totalRows: allRows.length,
          importedRows: imported,
          skippedRows: skippedRows.length,
          primaryKeyField,
          skippedDetails: skippedRows,
        })
        setShowSummary(true)
        setStep("complete")
        onImportComplete()
        // Ensure the page/grid re-renders with the newly inserted rows
        router.refresh()
      } else {
        throw new Error("No rows were imported. Please check your data and field mappings.")
      }
    } catch (err) {
      console.error("❌ Error importing CSV:", err)
      const errorMessage = err instanceof Error ? err.message : String(err)
      setError(`Failed to import CSV: ${errorMessage}`)
      setStep("mapping") // Clear spinner state on error
      setImportedCount(0) // Reset count on error
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
          {error}
        </div>
      )}
      
      {step === "upload" && (
        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium text-gray-700">Upload CSV File</Label>
            <p className="text-xs text-gray-500 mt-1">
              Select a CSV file to import into {tableName}
            </p>
          </div>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
            <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="hidden"
              id="csv-upload"
            />
            <Button
              variant="outline"
              className="cursor-pointer"
              onClick={() => {
                fileInputRef.current?.click()
              }}
              type="button"
            >
              <FileText className="h-4 w-4 mr-2" />
              Choose CSV File
            </Button>
          </div>
        </div>
      )}

      {step === "mapping" && (
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Map Columns</h3>
            <p className="text-xs text-gray-500">
              Map CSV columns to existing fields or create new ones
            </p>
          </div>

          <div className="space-y-3 max-h-96 overflow-y-auto">
            {csvHeaders.map((csvHeader) => {
              const mappedField = fieldMappings[csvHeader]
              const isNewField = !mappedField && newFields[csvHeader]

              return (
                <div key={csvHeader} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Label className="text-xs font-medium text-gray-700">
                        {csvHeader}
                      </Label>
                      {newFields[csvHeader] && !mappedField && (
                        <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">
                          Detected: {FIELD_TYPES.find(t => t.type === newFields[csvHeader])?.label || newFields[csvHeader]}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-500">
                      Sample: {csvRows[0]?.[csvHeader]?.substring(0, 30) || "—"}
                    </span>
                  </div>
                  <div className="space-y-2">
                    <Select
                      value={mappedField || "new"}
                      onValueChange={(value) => {
                        if (value === "new") {
                          // Remove mapping and ensure field type is set
                          setFieldMappings((prev) => {
                            const newMappings = { ...prev }
                            delete newMappings[csvHeader]
                            return newMappings
                          })
                          // Set default field type if not already set
                          if (!newFields[csvHeader]) {
                            handleNewFieldType(csvHeader, "text")
                          }
                        } else {
                          // Map to existing field - clear new field type
                          handleMappingChange(csvHeader, value)
                          setNewFields((prev) => {
                            const newFields = { ...prev }
                            delete newFields[csvHeader]
                            return newFields
                          })
                        }
                      }}
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue placeholder="Select or create field" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="new">+ Create new field</SelectItem>
                        {tableFields.map((field) => (
                          <SelectItem key={field.id} value={field.name}>
                            {getFieldDisplayName(field)} ({FIELD_TYPES.find(t => t.type === field.type)?.label})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {!mappedField && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs text-gray-600">Field Type</Label>
                          {newFields[csvHeader] && (
                            <span className="text-xs text-blue-600">
                              Auto-detected
                            </span>
                          )}
                        </div>
                        <Select
                          value={newFields[csvHeader] || "text"}
                          onValueChange={(value) => handleNewFieldType(csvHeader, value as FieldType)}
                        >
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue placeholder="Select field type" />
                          </SelectTrigger>
                          <SelectContent>
                            {FIELD_TYPES.filter(ft => !ft.isVirtual).map((ft) => (
                              <SelectItem key={ft.type} value={ft.type}>
                                {ft.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-gray-500">
                          A new field &quot;{csvHeader}&quot; will be created with this type
                          {newFields[csvHeader] && " (you can override the detected type above)"}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          <Button
            onClick={() => setStep("preview")}
            className="w-full"
            disabled={csvHeaders.length === 0}
          >
            Continue to Preview
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      )}

      {step === "preview" && (
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Preview</h3>
            <p className="text-xs text-gray-500">
              Review the first 10 rows before importing. Field types are auto-detected and can be changed by going back to mapping.
            </p>
          </div>

          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto max-h-64 pb-3">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {csvHeaders.map((header) => {
                      const mappedField = fieldMappings[header]
                      const newFieldType = newFields[header]
                      const fieldTypeLabel = mappedField 
                        ? tableFields.find(f => f.name === mappedField)?.type 
                        : newFieldType
                        ? FIELD_TYPES.find(t => t.type === newFieldType)?.label || newFieldType
                        : null
                      
                      return (
                        <th key={header} className="px-2 py-2 text-left font-medium text-gray-700">
                          <div className="flex flex-col">
                            <span>{mappedField ? formatFieldNameForDisplay(mappedField) : header}</span>
                            {fieldTypeLabel && (
                              <span className="text-xs font-normal text-gray-500 mt-0.5">
                                {mappedField ? `(${fieldTypeLabel})` : `New: ${fieldTypeLabel}`}
                              </span>
                            )}
                          </div>
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {(Array.isArray(csvRows) ? csvRows : []).slice(0, 10).map((row, idx) => (
                    <tr key={idx} className="border-b border-gray-100">
                      {csvHeaders.map((header) => (
                        <td key={header} className="px-2 py-2 text-gray-900">
                          {row[header]?.substring(0, 50) || "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setStep("mapping")}
              className="flex-1"
            >
              Back to Mapping
            </Button>
            <Button onClick={handleImport} className="flex-1">
              Import All Rows
            </Button>
          </div>
        </div>
      )}

      {step === "importing" && (
        <div className="text-center py-8 space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <div>
            <p className="text-sm font-medium text-gray-900">Importing...</p>
            <p className="text-xs text-gray-500 mt-1">
              {importedCount} rows imported
            </p>
          </div>
        </div>
      )}

      {step === "complete" && (
        <div className="text-center py-8 space-y-4">
          <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
            <Check className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">Import Complete!</p>
            <p className="text-xs text-gray-500 mt-1">
              {importedCount} rows imported successfully
            </p>
          </div>
            <Button
              onClick={() => {
                setStep("upload")
                setCsvHeaders([])
                setCsvRows([])
                setFieldMappings({})
                setNewFields({})
                setImportedCount(0)
                setError(null)
                if (fileInputRef.current) {
                  fileInputRef.current.value = ""
                }
              }}
              variant="outline"
              className="w-full"
            >
              Import Another File
            </Button>
        </div>
      )}

      {/* Import Summary Modal */}
      {importSummary && (
        <ImportSummaryModal
          open={showSummary}
          onOpenChange={(open) => {
            setShowSummary(open)
          }}
          totalRows={importSummary.totalRows}
          importedRows={importSummary.importedRows}
          skippedRows={importSummary.skippedRows}
          primaryKeyField={importSummary.primaryKeyField}
          skippedDetails={importSummary.skippedDetails}
        />
      )}
    </div>
  )
}
