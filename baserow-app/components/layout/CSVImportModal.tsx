"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Upload, FileText, CheckCircle, XCircle, Loader2, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { parseCSV, type ParsedCSV } from "@/lib/import/csvParser"
import { sanitizeFieldName } from "@/lib/fields/validation"
import { RESERVED_WORDS } from "@/types/fields"

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

type ImportStatus = 'idle' | 'parsing' | 'mapping' | 'preview' | 'importing' | 'success' | 'error'

interface CSVImportModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tableId: string
  tableName: string
  supabaseTableName: string
  onImportComplete: () => void
}

export default function CSVImportModal({
  open,
  onOpenChange,
  tableId,
  tableName,
  supabaseTableName,
  onImportComplete,
}: CSVImportModalProps) {
  const router = useRouter()
  const [status, setStatus] = useState<ImportStatus>('idle')
  const [file, setFile] = useState<File | null>(null)
  const [parsedData, setParsedData] = useState<ParsedCSV | null>(null)
  const [tableFields, setTableFields] = useState<TableField[]>([])
  const [fieldMappings, setFieldMappings] = useState<Record<string, string>>({}) // CSV column -> field name
  const [newFieldTypes, setNewFieldTypes] = useState<Record<string, FieldType>>({}) // CSV column -> field type
  const [linkTableOptions, setLinkTableOptions] = useState<Record<string, string>>({}) // CSV column -> linked_table_id
  const [availableTables, setAvailableTables] = useState<Array<{ id: string; name: string }>>([])
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState("")
  const [importedCount, setImportedCount] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadTableFields = useCallback(async () => {
    try {
      const response = await fetch(`/api/tables/${tableId}/fields`)
      if (response.ok) {
        const data = await response.json()
        setTableFields(data.fields || [])
      }
    } catch (error) {
      console.error("Error loading fields:", error)
    }
  }, [tableId])

  const loadAvailableTables = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('tables')
        .select('id, name')
        .order('name', { ascending: true })

      if (!error && data) {
        setAvailableTables(data.filter(t => t.id !== tableId)) // Exclude current table
      }
    } catch (error) {
      console.error('Error loading tables:', error)
    }
  }, [tableId])

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!open) {
      setStatus('idle')
      setFile(null)
      setParsedData(null)
      setError(null)
      setProgress("")
      setImportedCount(0)
      setLinkTableOptions({})
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    } else {
      loadTableFields()
      loadAvailableTables()
    }
  }, [open, tableId, loadTableFields, loadAvailableTables])

  // Advanced field type detection from sample values
  const detectFieldType = useCallback((sampleValues: string[]): FieldType => {
    if (sampleValues.length === 0) return 'text'
    
    const threshold = Math.max(1, Math.floor(sampleValues.length * 0.4)) // 40% threshold
    const nonEmptyValues = sampleValues.filter(v => v && String(v).trim())

    if (nonEmptyValues.length === 0) return 'text'

    // Check for JSON pattern first (most specific)
    const jsonPattern = /^[\s]*[{\[]/
    const jsonMatches = nonEmptyValues.filter(v => {
      const trimmed = String(v).trim()
      if (!jsonPattern.test(trimmed)) return false
      try {
        JSON.parse(trimmed)
        return true
      } catch {
        return false
      }
    }).length
    
    if (jsonMatches >= threshold) {
      return 'json'
    }

    // Check for email pattern
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    const emailMatches = nonEmptyValues.filter(v => emailPattern.test(String(v).trim())).length
    if (emailMatches >= threshold) {
      return 'email'
    }

    // Check for URL pattern - improved detection
    const urlMatches = nonEmptyValues.filter(v => {
      const trimmed = String(v).trim().toLowerCase()
      // Check for http/https
      if (/^https?:\/\//.test(trimmed)) return true
      // Check for www.
      if (/^www\./.test(trimmed)) return true
      // Check for domain pattern (has TLD)
      if (/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}/.test(trimmed)) return true
      // Check for URLs with paths (contains . and /)
      if (trimmed.includes('.') && trimmed.includes('/') && !trimmed.includes(' ')) return true
      // Check for common URL patterns
      if (trimmed.match(/^[a-z]+:\/\//)) return true
      return false
    }).length
    if (urlMatches >= threshold) {
      return 'url'
    }

    // Check for boolean/checkbox
    const booleanValues = ['true', 'false', 'yes', 'no', '1', '0', 'y', 'n', 't', 'f']
    const booleanMatches = nonEmptyValues.filter(v => 
      booleanValues.includes(String(v).toLowerCase().trim())
    ).length
    if (booleanMatches >= threshold) {
      return 'checkbox'
    }

    // Check for categorical data (single_select or multi_select) BEFORE checking dates/numbers
    const uniqueValues = new Set(nonEmptyValues.map(v => String(v).trim().toLowerCase()))
    const uniqueCount = uniqueValues.size
    const totalCount = nonEmptyValues.length
    
    // If we have few unique values relative to total, it's likely categorical
    if (totalCount >= 3 && (uniqueCount <= Math.max(2, Math.floor(totalCount * 0.5)) || uniqueCount <= 15)) {
      // Check if values contain commas or semicolons (multi-select indicator)
      const multiSelectIndicators = nonEmptyValues.filter(v => 
        /[,;]/.test(String(v).trim())
      ).length
      
      if (multiSelectIndicators >= Math.floor(totalCount * 0.4)) {
        return 'multi_select'
      } else {
        // Likely single-select category
        const valueCounts = new Map<string, number>()
        nonEmptyValues.forEach(v => {
          const key = String(v).trim().toLowerCase()
          valueCounts.set(key, (valueCounts.get(key) || 0) + 1)
        })
        const maxCount = Math.max(...Array.from(valueCounts.values()))
        if (maxCount >= 2 && uniqueCount <= 15) {
          return 'single_select'
        }
      }
    }

    // Check for date pattern
    const datePatterns = [
      /^\d{4}[-\/]\d{1,2}[-\/]\d{1,2}$/,
      /^\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}$/,
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
      /^\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i,
      /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}/i,
    ]
    
    const dateMatches = nonEmptyValues.filter(v => {
      const trimmed = String(v).trim()
      if (datePatterns.some(p => p.test(trimmed))) return true
      const date = new Date(trimmed)
      if (!isNaN(date.getTime())) {
        const year = date.getFullYear()
        return year >= 1900 && year <= 2100
      }
      return false
    }).length
    
    if (dateMatches >= threshold) {
      return 'date'
    }

    // Check for number
    const cleanedValues = nonEmptyValues.map(v => String(v).trim().replace(/[$€£¥%,\s]/g, ''))
    const numberPattern = /^-?\d+(\.\d+)?$/
    const numberMatches = cleanedValues.filter(v => numberPattern.test(v)).length
    
    if (numberMatches >= threshold) {
      const percentCount = nonEmptyValues.filter(v => String(v).includes('%')).length
      if (percentCount >= threshold) {
        return 'percent'
      }
      const currencyCount = nonEmptyValues.filter(v => 
        /[$€£¥]/.test(String(v)) || String(v).toLowerCase().includes('usd') || String(v).toLowerCase().includes('gbp')
      ).length
      if (currencyCount >= threshold) {
        return 'currency'
      }
      return 'number'
    }

    // Default to text
    return 'text'
  }, [])

  const handleFileSelect = useCallback(async (selectedFile: File) => {
    if (!selectedFile.name.endsWith('.csv')) {
      setError('Please select a CSV file')
      return
    }

    setFile(selectedFile)
    setStatus('parsing')
    setError(null)
    setProgress('Parsing CSV file...')

    try {
      const parsed = await parseCSV(selectedFile)
      setParsedData(parsed)
      
      // Auto-map headers to existing fields and auto-detect types for new fields
      const mappings: Record<string, string> = {}
      const autoDetectedTypes: Record<string, FieldType> = {}
      
      parsed.columns.forEach((col) => {
        const sanitizedColName = sanitizeFieldNameSafe(col.name)
        const existingField = tableFields.find(
          (f) => f.name.toLowerCase() === sanitizedColName.toLowerCase()
        )
        
        if (existingField) {
          mappings[col.name] = existingField.name
        } else {
          // Extract sample values from across the dataset for better detection
          // Check up to 200 rows to find patterns even if some rows are empty
          const totalRows = parsed.rows.length
          const maxSampleRows = Math.min(200, totalRows)
          
          const sampleValues: any[] = []
          // Sample evenly across the dataset, not just from the beginning
          const step = totalRows > maxSampleRows ? Math.ceil(totalRows / maxSampleRows) : 1
          
          for (let i = 0; i < totalRows && sampleValues.length < maxSampleRows; i += step) {
            const value = parsed.rows[i]?.[col.name]
            if (value !== null && value !== undefined && value !== '') {
              sampleValues.push(value)
            }
          }
          
          // Also ensure we check the first 20 rows (in case step skips them)
          if (step > 1 && sampleValues.length < maxSampleRows) {
            for (let i = 0; i < Math.min(20, totalRows); i++) {
              const value = parsed.rows[i]?.[col.name]
              if (value !== null && value !== undefined && value !== '') {
                sampleValues.push(value)
                if (sampleValues.length >= maxSampleRows) break
              }
            }
          }
          
          // Use advanced detection if we have sample values, otherwise fall back to basic CSV parser type
          if (sampleValues.length > 0) {
            autoDetectedTypes[col.name] = detectFieldType(sampleValues.map(v => String(v)))
          } else {
            // Fall back to basic CSV parser type
            const mapCSVTypeToFieldType = (csvType: 'text' | 'number' | 'boolean' | 'date'): FieldType => {
              switch (csvType) {
                case 'number':
                  return 'number'
                case 'boolean':
                  return 'checkbox'
                case 'date':
                  return 'date'
                case 'text':
                default:
                  return 'text'
              }
            }
            autoDetectedTypes[col.name] = mapCSVTypeToFieldType(col.type)
          }
        }
      })
      
      setFieldMappings(mappings)
      setNewFieldTypes(autoDetectedTypes)
      setStatus('mapping')
      setProgress('')
    } catch (err: any) {
      setError(err.message || 'Failed to parse CSV file')
      setStatus('error')
      setFile(null)
      setProgress('')
    }
  }, [tableFields, detectFieldType])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile) {
      handleFileSelect(droppedFile)
    }
  }, [handleFileSelect])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      handleFileSelect(selectedFile)
    }
  }, [handleFileSelect])

  async function handleImport() {
    if (!parsedData) {
      setError('Please upload a CSV file first')
      return
    }

    // Validate that at least one column is mapped
    const mappedColumns = parsedData.columns.filter(col => 
      fieldMappings[col.name] || newFieldTypes[col.name]
    )
    
    if (mappedColumns.length === 0) {
      setError('Please map at least one CSV column to a field before importing.')
      return
    }

    setStatus('importing')
    setError(null)
    setImportedCount(0)

    try {
      // Phase 1: Use user's field mappings and create new fields as specified
      setProgress('Mapping columns to fields...')
      
      const columnMappings: Record<string, string> = { ...fieldMappings } // CSV column name -> field name
      const fieldsToCreate: Array<{ name: string; type: FieldType; options?: any }> = []

      // Collect fields that need to be created (from newFieldTypes)
      parsedData.columns.forEach((col) => {
        // If column is mapped to existing field, skip
        if (columnMappings[col.name]) {
          return
        }
        
        // If column has a new field type specified, add it to create list
        if (newFieldTypes[col.name]) {
          // Validate that the field type can be created from CSV import
          if (newFieldTypes[col.name] === 'link_to_table') {
            if (!linkTableOptions[col.name]) {
              throw new Error(
                `Field "${col.name}" is set as "Link to table" but no linked table has been selected. ` +
                `Please select a table to link to in the mapping step.`
              )
            }
          }
          
          if (newFieldTypes[col.name] === 'lookup') {
            throw new Error(
              `Field "${col.name}" cannot be created as "Lookup" during CSV import. ` +
              `This is a virtual field type that cannot be imported. ` +
              `Please change the field type to another appropriate type.`
            )
          }
          
          const fieldData: { name: string; type: FieldType; options?: any } = {
            name: col.name,
            type: newFieldTypes[col.name],
          }

          // Extract choices for select fields
          if (newFieldTypes[col.name] === 'single_select' || newFieldTypes[col.name] === 'multi_select') {
            const uniqueChoices = new Set<string>()
            let valuesFound = 0
            
            // Extract from all rows in parsedData
            // Use the exact column name from the parsed data
            parsedData.rows.forEach((row, rowIndex) => {
              // Try exact match first, then try case-insensitive
              let value = row[col.name]
              if (value === undefined) {
                // Try case-insensitive match
                const matchingKey = Object.keys(row).find(key => key.toLowerCase() === col.name.toLowerCase())
                if (matchingKey) {
                  value = row[matchingKey]
                }
              }
              
              if (value !== null && value !== undefined && value !== '') {
                const stringValue = String(value).trim()
                if (stringValue) {
                  valuesFound++
                  if (newFieldTypes[col.name] === 'multi_select') {
                    // Split by comma or semicolon for multi-select
                    const parts = stringValue.split(/[,;]/).map(p => p.trim()).filter(p => p)
                    parts.forEach(part => uniqueChoices.add(part))
                  } else {
                    // Single select - use value as-is
                    uniqueChoices.add(stringValue)
                  }
                }
              }
            })
            
            // Convert to sorted array and limit to reasonable number
            const choices = Array.from(uniqueChoices).sort().slice(0, 100)
            
            // Single_select and multi_select require at least one choice
            if (choices.length === 0) {
              const availableColumns = parsedData.rows.length > 0 ? Object.keys(parsedData.rows[0]).join(', ') : 'none'
              throw new Error(
                `Field "${col.name}" is set as ${newFieldTypes[col.name]}, but no valid choices were found in the CSV data. ` +
                `Found ${parsedData.rows.length} rows, ${valuesFound} non-empty values. ` +
                `Available columns: ${availableColumns}. ` +
                `Please either change the field type or ensure the column contains selectable values.`
              )
            }
            
            // Always set options for select fields
            fieldData.options = { choices }
            console.log(`Extracted ${choices.length} choices for "${col.name}" from ${valuesFound} values:`, choices.slice(0, 10))
          }

          // Set linked_table_id for link_to_table fields
          if (newFieldTypes[col.name] === 'link_to_table') {
            const linkedTableId = linkTableOptions[col.name]
            if (linkedTableId) {
              fieldData.options = { linked_table_id: linkedTableId }
            }
          }

          fieldsToCreate.push(fieldData)
        }
        // Otherwise, column is unmapped and will be skipped
      })

      // Phase 2: Create new fields with user-selected types
      if (fieldsToCreate.length > 0) {
        setProgress(`Creating ${fieldsToCreate.length} new fields...`)
        
        for (const fieldInfo of fieldsToCreate) {
          const sanitizedName = sanitizeFieldNameSafe(fieldInfo.name)
          
          const requestBody: any = {
            name: sanitizedName,
            type: fieldInfo.type,
            required: false,
          }

          // Always include options for select fields (required by validation)
          if (fieldInfo.type === 'single_select' || fieldInfo.type === 'multi_select') {
            if (!fieldInfo.options || !fieldInfo.options.choices || fieldInfo.options.choices.length === 0) {
              throw new Error(
                `Field "${fieldInfo.name}" is set as ${fieldInfo.type} but has no choices configured. ` +
                `This should not happen - please report this error.`
              )
            }
            requestBody.options = fieldInfo.options
          } else if (fieldInfo.type === 'link_to_table') {
            // Include linked_table_id for link_to_table fields
            const linkedTableId = linkTableOptions[fieldInfo.name]
            if (!linkedTableId) {
              throw new Error(
                `Field "${fieldInfo.name}" is set as link_to_table but no linked table has been selected.`
              )
            }
            requestBody.options = { linked_table_id: linkedTableId }
          } else if (fieldInfo.options) {
            // Include options for other field types if present
            requestBody.options = fieldInfo.options
          }
          
          console.log(`Creating field "${fieldInfo.name}" (${fieldInfo.type}) with options:`, requestBody.options)
          
          const response = await fetch(`/api/tables/${tableId}/fields`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestBody),
          })

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
            throw new Error(`Failed to create field "${fieldInfo.name}": ${errorData.error || 'Unknown error'}`)
          }

          const createdField = await response.json().catch(() => null)
          if (createdField?.field?.name) {
            columnMappings[fieldInfo.name] = createdField.field.name
          }
        }

        // Reload fields after creation
        await loadTableFields()
        const response = await fetch(`/api/tables/${tableId}/fields`)
        const fieldsData = await response.ok ? await response.json() : { fields: [] }
        const updatedFields = fieldsData.fields || []
        setTableFields(updatedFields)
      }

      // Reload fields one more time to ensure we have the latest
      const finalFieldsResponse = await fetch(`/api/tables/${tableId}/fields`)
      const finalFieldsData = finalFieldsResponse.ok ? await finalFieldsResponse.json() : { fields: [] }
      const allFields = finalFieldsData.fields || tableFields

      // Phase 3: Prepare rows for insertion
      setProgress('Preparing rows for insertion...')

      const rowsToInsert = parsedData.rows
        .map((csvRow) => {
          const mappedRow: Record<string, any> = {}
          
          parsedData.columns.forEach((col) => {
            const fieldName = columnMappings[col.name]
            if (!fieldName) return // Skip unmapped columns (user chose not to import this column)

            const field = allFields.find((f: TableField) => f.name === fieldName)
            if (!field) {
              console.warn(`Field "${fieldName}" not found, skipping column "${col.name}"`)
              return
            }

            let value: any = csvRow[col.name]
            
            if (value === '' || value === null || value === undefined) {
              value = null
            } else {
              // Type conversion based on field type
              if (field.type === "number" || field.type === "currency" || field.type === "percent") {
                value = parseFloat(value) || 0
              } else if (field.type === "checkbox") {
                value = (String(value).toLowerCase() === "true" || value === "1" || String(value).toLowerCase() === "yes")
              } else if (field.type === "date") {
                const date = new Date(value)
                value = isNaN(date.getTime()) ? null : date.toISOString()
              } else if (field.type === "multi_select") {
                value = String(value).split(/[,;]/).map(p => p.trim()).filter(p => p)
              } else {
                value = String(value).trim()
              }
            }

            mappedRow[fieldName] = value
          })

          return mappedRow
        })
        .filter(row => Object.keys(row).length > 0)

      if (rowsToInsert.length === 0) {
        throw new Error(
          `No valid rows to import. ` +
          `Total CSV rows: ${parsedData.rows.length}, ` +
          `Mapped columns: ${Object.keys(columnMappings).length}/${parsedData.columns.length}. ` +
          `Please ensure at least one column is mapped and contains data.`
        )
      }

      // Phase 4: Insert rows in batches
      setProgress(`Inserting ${rowsToInsert.length} rows...`)

      const batchSize = 100
      let totalImported = 0

      for (let i = 0; i < rowsToInsert.length; i += batchSize) {
        const batch = rowsToInsert.slice(i, i + batchSize)
        
        if (batch.length === 0) continue

        const { error: insertError, data: insertedData } = await supabase
          .from(supabaseTableName)
          .insert(batch)
          .select('id')

        if (insertError) {
          console.error("Error inserting batch:", insertError)
          
          if (insertError.message?.includes('column') || insertError.code === '42703' || insertError.code === '42P01' || insertError.code === 'PGRST116') {
            const columnMatch = insertError.message?.match(/column ['"]([^'"]+)['"]/)
            const columnName = columnMatch ? columnMatch[1] : 'unknown'
            // Reload fields for error message
            const errorFieldsResponse = await fetch(`/api/tables/${tableId}/fields`)
            const errorFieldsData = errorFieldsResponse.ok ? await errorFieldsResponse.json() : { fields: [] }
            const errorFields = errorFieldsData.fields || []
            
            throw new Error(
              `Column "${columnName}" does not exist in table "${supabaseTableName}". ` +
              `Available fields: ${errorFields.map((f: TableField) => f.name).join(', ')}. ` +
              `Original error: ${insertError.message}`
            )
          }

          if (insertError.message?.includes('null value') || insertError.code === '23502') {
            throw new Error(
              `Required field is missing data. Please ensure all required fields have values. ` +
              `Error: ${insertError.message}`
            )
          }

          throw new Error(`Failed to insert rows: ${insertError.message || JSON.stringify(insertError)}`)
        }

        const insertedCount = insertedData?.length || batch.length
        totalImported += insertedCount
        setImportedCount(totalImported)
        setProgress(`Inserted ${totalImported} of ${rowsToInsert.length} rows...`)
      }

      if (totalImported === 0) {
        throw new Error("No rows were imported. Please check your data and field mappings.")
      }

      setStatus('success')
      setProgress(`Successfully imported ${totalImported} rows`)
      setImportedCount(totalImported)

      // Refresh grid immediately
      onImportComplete()
      
      // Refresh the page to show new data
      router.refresh()

      // Close modal after short delay
      setTimeout(() => {
        onOpenChange(false)
      }, 2000)

    } catch (err) {
      console.error("Error importing CSV:", err)
      const errorMessage = err instanceof Error ? err.message : String(err)
      
      // Check if the error is about missing table_fields table
      if (errorMessage.includes('table_fields table does not exist') || 
          errorMessage.includes('MISSING_TABLE')) {
        setError(
          `Database Setup Required\n\n` +
          `The table_fields table is missing. To fix this:\n\n` +
          `1. Go to your Supabase Dashboard\n` +
          `2. Navigate to SQL Editor\n` +
          `3. Run the migration file: supabase/migrations/create_table_fields.sql\n\n` +
          `This migration creates the required table for field management.`
        )
      } else {
        setError(`Failed to import CSV: ${errorMessage}`)
      }
      
      setStatus('error')
      setProgress("")
      setImportedCount(0)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] max-h-[90vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle>Import CSV to {tableName}</DialogTitle>
          <DialogDescription>
            Import data from a CSV file. New fields will be created with auto-detected types (text, number, date, checkbox).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Error Display */}
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-4">
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-red-600" />
                <h3 className="font-semibold text-red-900">Import Failed</h3>
              </div>
              <p className="mt-2 text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* File Upload Area */}
          {status === 'idle' || status === 'error' ? (
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:border-blue-500 transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Drop CSV file here or click to browse</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Supports CSV files exported from Airtable or any standard CSV format
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileInput}
                className="hidden"
              />
              <Button>
                <FileText className="h-4 w-4 mr-2" />
                Choose CSV File
              </Button>
            </div>
          ) : null}

          {/* Parsing Status */}
          {status === 'parsing' && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground">{progress}</p>
            </div>
          )}

          {/* Mapping Step */}
          {status === 'mapping' && parsedData && (
            <div className="space-y-6">
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">Map Columns</h3>
                <p className="text-sm text-muted-foreground">
                  Map CSV columns to existing fields or create new ones. Field types are auto-detected and can be changed.
                </p>
              </div>

              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {parsedData.columns.map((col) => {
                  const mappedField = fieldMappings[col.name]
                  const isNewField = !mappedField && newFieldTypes[col.name]

                  return (
                    <div key={col.name} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Label className="text-sm font-medium text-gray-700">
                            {col.name}
                          </Label>
                          {newFieldTypes[col.name] && !mappedField && (
                            <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
                              Detected: {FIELD_TYPES.find(t => t.type === newFieldTypes[col.name])?.label || newFieldTypes[col.name]}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-gray-500">
                          Sample: {(() => {
                            const sample = parsedData.previewRows[0]?.[col.name]
                            if (sample === null || sample === undefined) return "—"
                            if (Array.isArray(sample)) return sample.join(', ').substring(0, 30)
                            return String(sample).substring(0, 30)
                          })()}
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
                                delete newMappings[col.name]
                                return newMappings
                              })
                              // Set default field type if not already set
                              if (!newFieldTypes[col.name]) {
                                const mapCSVTypeToFieldType = (csvType: 'text' | 'number' | 'boolean' | 'date'): FieldType => {
                                  switch (csvType) {
                                    case 'number':
                                      return 'number'
                                    case 'boolean':
                                      return 'checkbox'
                                    case 'date':
                                      return 'date'
                                    case 'text':
                                    default:
                                      return 'text'
                                  }
                                }
                                setNewFieldTypes((prev) => ({
                                  ...prev,
                                  [col.name]: mapCSVTypeToFieldType(col.type)
                                }))
                              }
                            } else {
                              // Map to existing field - clear new field type
                              setFieldMappings((prev) => ({
                                ...prev,
                                [col.name]: value,
                              }))
                              setNewFieldTypes((prev) => {
                                const newTypes = { ...prev }
                                delete newTypes[col.name]
                                return newTypes
                              })
                            }
                          }}
                        >
                          <SelectTrigger className="h-9 text-sm">
                            <SelectValue placeholder="Select or create field" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="new">+ Create new field</SelectItem>
                            {tableFields.map((field) => (
                              <SelectItem key={field.id} value={field.name}>
                                {field.name} ({FIELD_TYPES.find(t => t.type === field.type)?.label || field.type})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        {!mappedField && (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <Label className="text-xs text-gray-600">Field Type</Label>
                              {newFieldTypes[col.name] && (
                                <span className="text-xs text-blue-600">
                                  Auto-detected
                                </span>
                              )}
                            </div>
                            <Select
                              value={newFieldTypes[col.name] || "text"}
                              onValueChange={(value) => {
                                setNewFieldTypes((prev) => ({
                                  ...prev,
                                  [col.name]: value as FieldType,
                                }))
                              }}
                            >
                              <SelectTrigger className="h-9 text-sm">
                                <SelectValue placeholder="Select field type" />
                              </SelectTrigger>
                              <SelectContent>
                                {FIELD_TYPES.filter(ft => {
                                  // Filter out virtual fields
                                  if (ft.isVirtual) return false
                                  // Filter out lookup - virtual and requires configuration
                                  if (ft.type === 'lookup') return false
                                  return true
                                }).map((ft) => (
                                  <SelectItem key={ft.type} value={ft.type}>
                                    {ft.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            
                            {/* Show linked table selector for link_to_table fields */}
                            {newFieldTypes[col.name] === 'link_to_table' && (
                              <div className="space-y-1 mt-2">
                                <Label className="text-xs text-gray-600">Linked Table</Label>
                                <Select
                                  value={linkTableOptions[col.name] || undefined}
                                  onValueChange={(tableId) => {
                                    setLinkTableOptions((prev) => {
                                      if (tableId) {
                                        return {
                                          ...prev,
                                          [col.name]: tableId,
                                        }
                                      } else {
                                        const { [col.name]: _, ...rest } = prev
                                        return rest
                                      }
                                    })
                                  }}
                                >
                                  <SelectTrigger className="h-9 text-sm">
                                    <SelectValue placeholder="Select a table to link to" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {availableTables.map((table) => (
                                      <SelectItem key={table.id} value={table.id}>
                                        {table.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <p className="text-xs text-gray-500">
                                  Select the table this field should link to
                                </p>
                              </div>
                            )}
                            
                            <p className="text-xs text-gray-500">
                              A new field &quot;{col.name}&quot; will be created with this type
                              {newFieldTypes[col.name] && " (you can override the detected type above)"}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setFile(null)
                    setParsedData(null)
                    setFieldMappings({})
                    setNewFieldTypes({})
                    setLinkTableOptions({})
                    setStatus('idle')
                    setError(null)
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => setStatus('preview')}
                  className="flex-1"
                  disabled={parsedData.columns.length === 0}
                >
                  Continue to Preview
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>
          )}

          {/* Preview */}
          {status === 'preview' && parsedData && (
            <div className="space-y-6">
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">Preview</h3>
                <p className="text-sm text-muted-foreground">
                  Review the data before importing. {parsedData.rows.length} rows will be imported.
                </p>
                <div className="border rounded-lg overflow-hidden w-full">
                  <div className="overflow-x-auto max-h-[400px] overflow-y-auto w-full" style={{ scrollbarWidth: 'thin', WebkitOverflowScrolling: 'touch' }}>
                    <table className="text-sm" style={{ minWidth: 'max-content' }}>
                      <thead className="bg-gray-50 border-b sticky top-0 z-10">
                        <tr>
                          {parsedData.columns.map((col) => {
                            const mappedField = fieldMappings[col.name]
                            const newFieldType = newFieldTypes[col.name]
                            const fieldTypeLabel = mappedField 
                              ? tableFields.find(f => f.name === mappedField)?.type 
                              : newFieldType
                                ? FIELD_TYPES.find(t => t.type === newFieldType)?.label || newFieldType
                                : null
                            
                            return (
                              <th key={col.name} className="px-4 py-2 text-left font-semibold text-gray-700 bg-gray-50 whitespace-nowrap">
                                <div className="flex flex-col">
                                  <span>{col.name}</span>
                                  <span className="text-xs font-normal text-gray-500">
                                    {mappedField 
                                      ? `→ ${mappedField} (${fieldTypeLabel || 'unknown'})`
                                      : newFieldType
                                        ? `→ New field: ${fieldTypeLabel || newFieldType}`
                                        : `→ Skipped (unmapped)`}
                                  </span>
                                </div>
                              </th>
                            )
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {(Array.isArray(parsedData.previewRows) ? parsedData.previewRows : []).map((row, idx) => {
                          // Ensure row is an object
                          if (!row || typeof row !== 'object') {
                            return null
                          }
                          return (
                            <tr key={idx} className="border-b hover:bg-gray-50">
                              {parsedData.columns.map((col) => {
                                const value = row[col.name]
                                // Handle arrays (multi-select) and other non-string values
                                let displayValue = ''
                                if (value === null || value === undefined) {
                                  displayValue = ''
                                } else if (Array.isArray(value)) {
                                  displayValue = Array.isArray(value) ? value.join(', ') : String(value)
                                } else {
                                  displayValue = String(value)
                                }
                                return (
                                  <td key={col.name} className="px-4 py-2 whitespace-nowrap">
                                    {displayValue.substring(0, 50)}
                                  </td>
                                )
                              })}
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Showing first 10 rows of {parsedData.rows.length} total rows
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={() => setStatus('mapping')}
                  variant="outline"
                >
                  Back to Mapping
                </Button>
                <Button
                  onClick={handleImport}
                  disabled={parsedData.rows.length === 0 || parsedData.columns.filter(col => fieldMappings[col.name] || newFieldTypes[col.name]).length === 0}
                  className="flex-1"
                >
                  Import {parsedData.rows.length} Rows
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setFile(null)
                    setParsedData(null)
                    setFieldMappings({})
                    setNewFieldTypes({})
                    setLinkTableOptions({})
                    setStatus('idle')
                    setError(null)
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Importing Status */}
          {status === 'importing' && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground">{progress}</p>
              {importedCount > 0 && (
                <p className="text-sm text-muted-foreground">{importedCount} rows imported so far</p>
              )}
            </div>
          )}

          {/* Success */}
          {status === 'success' && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <div className="rounded-full bg-green-100 p-3">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-semibold">Import Complete!</h2>
              <p className="text-muted-foreground">
                Successfully imported {importedCount} rows into &quot;{tableName}&quot;
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
