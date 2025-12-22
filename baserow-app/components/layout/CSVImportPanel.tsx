"use client"

import { useState, useRef, useEffect } from "react"
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
import { sanitizeFieldName } from "@/lib/fields/validation"

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
  const [step, setStep] = useState<ImportStep>("upload")
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [csvRows, setCsvRows] = useState<CSVRow[]>([])
  const [tableFields, setTableFields] = useState<TableField[]>([])
  const [fieldMappings, setFieldMappings] = useState<Record<string, string>>({})
  const [newFields, setNewFields] = useState<Record<string, FieldType>>({})
  const [importedCount, setImportedCount] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load table fields
  useEffect(() => {
    loadFields()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableId])

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

    const text = await file.text()
    const { headers, rows } = parseCSV(text)

    if (headers.length === 0) {
      alert("CSV file appears to be empty or invalid")
      return
    }

    setCsvHeaders(headers)
    setCsvRows(rows)

    // Auto-map headers to existing fields
    const mappings: Record<string, string> = {}
    const autoDetectedTypes: Record<string, FieldType> = {}
    
    headers.forEach((header) => {
      const matchingField = tableFields.find(
        (f) => f.name.toLowerCase() === header.toLowerCase()
      )
      if (matchingField) {
        mappings[header] = matchingField.name
      } else {
        // Auto-detect field type from sample data
        const sampleValues = rows.slice(0, 10).map(row => row[header]).filter(v => v && v.trim())
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
  }

  // Auto-detect field type from sample values
  // Uses a threshold approach: if >70% of values match a pattern, use that type
  function detectFieldType(sampleValues: string[]): FieldType {
    if (sampleValues.length === 0) return 'text'
    
    const threshold = Math.max(1, Math.floor(sampleValues.length * 0.7)) // 70% threshold
    const nonEmptyValues = sampleValues.filter(v => v && v.trim())

    if (nonEmptyValues.length === 0) return 'text'

    // Check for email pattern (at least 70% match)
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    const emailMatches = nonEmptyValues.filter(v => emailPattern.test(v.trim())).length
    if (emailMatches >= threshold) {
      return 'email'
    }

    // Check for URL pattern (at least 70% match) - more comprehensive
    const urlPatterns = [
      /^https?:\/\//i, // http:// or https://
      /^www\./i, // www.example.com
      /^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,}/i, // domain.com
    ]
    const urlMatches = nonEmptyValues.filter(v => {
      const trimmed = v.trim()
      return urlPatterns.some(p => p.test(trimmed)) || 
             (trimmed.includes('.') && trimmed.includes('/') && !trimmed.includes(' '))
    }).length
    if (urlMatches >= threshold) {
      return 'url'
    }

    // Check for date pattern (common formats) - at least 70% match
    // More comprehensive date patterns
    const datePatterns = [
      /^\d{4}[-\/]\d{1,2}[-\/]\d{1,2}$/, // YYYY-MM-DD, YYYY/MM/DD
      /^\d{1,2}[-\/]\d{1,2}[-\/]\d{4}$/, // MM/DD/YYYY, DD-MM-YYYY
      /^\d{1,2}[-\/]\d{1,2}[-\/]\d{2}$/, // MM/DD/YY
      /^\d{1,2}[-\/]\d{1,2}[-\/]\d{4}\s+\d{1,2}:\d{2}/, // MM/DD/YYYY HH:MM
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/, // ISO datetime
      /^\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}/i, // DD Mon YYYY
      /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}/i, // Mon DD, YYYY
    ]
    
    // Also try parsing as Date object
    const dateMatches = nonEmptyValues.filter(v => {
      const trimmed = v.trim()
      // Check regex patterns
      if (datePatterns.some(p => p.test(trimmed))) {
        return true
      }
      // Try parsing as date
      const date = new Date(trimmed)
      if (!isNaN(date.getTime())) {
        // Additional validation: check if it's a reasonable date (not epoch 0)
        const year = date.getFullYear()
        return year >= 1900 && year <= 2100
      }
      return false
    }).length
    
    if (dateMatches >= threshold) {
      return 'date'
    }

    // Check for number (integer or decimal) - at least 70% match
    // Remove currency symbols and percentage signs for number detection
    const cleanedValues = nonEmptyValues.map(v => v.trim().replace(/[$€£¥%,\s]/g, ''))
    const numberPattern = /^-?\d+(\.\d+)?$/
    const numberMatches = cleanedValues.filter(v => numberPattern.test(v)).length
    
    if (numberMatches >= threshold) {
      // Check if it's a percentage (contains % in original)
      const percentCount = nonEmptyValues.filter(v => v.includes('%')).length
      if (percentCount >= threshold) {
        return 'percent'
      }
      // Check if it's currency (contains currency symbols)
      const currencyCount = nonEmptyValues.filter(v => 
        /[$€£¥]/.test(v) || v.toLowerCase().includes('usd') || v.toLowerCase().includes('gbp')
      ).length
      if (currencyCount >= threshold) {
        return 'currency'
      }
      return 'number'
    }

    // Check for boolean/checkbox - at least 70% match
    const booleanValues = ['true', 'false', 'yes', 'no', '1', '0', 'y', 'n', 't', 'f']
    const booleanMatches = nonEmptyValues.filter(v => 
      booleanValues.includes(v.toLowerCase().trim())
    ).length
    if (booleanMatches >= threshold) {
      return 'checkbox'
    }

    // Check for JSON pattern - at least 70% match
    // JSON typically starts with { or [ and contains key-value pairs
    const jsonPattern = /^[\s]*[{\[]/
    const jsonMatches = nonEmptyValues.filter(v => {
      const trimmed = v.trim()
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

    // Check for categorical data (single_select or multi_select)
    // If there are limited unique values that repeat frequently, it's likely a category
    const uniqueValues = new Set(nonEmptyValues.map(v => v.trim().toLowerCase()))
    const uniqueCount = uniqueValues.size
    const totalCount = nonEmptyValues.length
    
    // If we have relatively few unique values compared to total (e.g., < 20 unique values for 10+ samples)
    // and values repeat, it's likely categorical
    if (totalCount >= 5 && uniqueCount <= Math.min(20, Math.floor(totalCount * 0.8))) {
      // Check if values contain commas or semicolons (multi-select indicator)
      const multiSelectIndicators = nonEmptyValues.filter(v => 
        /[,;]/.test(v.trim())
      ).length
      
      if (multiSelectIndicators >= Math.floor(totalCount * 0.5)) {
        // More than 50% have separators - likely multi-select
        return 'multi_select'
      } else {
        // Likely single-select category
        return 'single_select'
      }
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

    try {
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

      const fieldsToCreate: Array<{ name: string; type: FieldType; options?: any }> = []
      csvHeaders.forEach((header) => {
        if (!fieldMappings[header] && newFields[header]) {
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
      
      for (const fieldData of fieldsToCreate) {
        const response = await fetch(`/api/tables/${tableId}/fields`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(fieldData),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
          throw new Error(`Failed to create field "${fieldData.name}": ${errorData.error || 'Unknown error'}`)
        }
        
        // Get the created field data to know the exact sanitized name
        const createdField = await response.json().catch(() => null)
        if (createdField?.field?.name) {
          // API returns { field: { name: "...", ... } }
          createdFieldNames[fieldData.name] = createdField.field.name
        } else if (createdField?.name) {
          // Sometimes API might return field directly
          createdFieldNames[fieldData.name] = createdField.name
        } else {
          // Fallback: sanitize the name ourselves (should match API)
          const sanitized = sanitizeFieldName(fieldData.name)
          createdFieldNames[fieldData.name] = sanitized
          console.warn(`Field creation response format unexpected for "${fieldData.name}", using sanitized name: ${sanitized}`)
        }
      }

      // Wait longer for schema cache to update and reload fields
      // Supabase schema cache can take a moment to refresh
      await new Promise(resolve => setTimeout(resolve, 1500))
      await loadFields()
      
      // Fetch updated fields multiple times to ensure we have the latest
      let updatedFields: TableField[] = []
      for (let attempt = 0; attempt < 5; attempt++) {
        const updatedFieldsResponse = await fetch(`/api/tables/${tableId}/fields`)
        if (updatedFieldsResponse.ok) {
          const data = await updatedFieldsResponse.json()
          updatedFields = data.fields || []
          
          // Verify all created fields are present
          const allCreatedFieldsFound = fieldsToCreate.every(fieldData => {
            const sanitizedName = createdFieldNames[fieldData.name]
            return updatedFields.some((f: TableField) => f.name === sanitizedName)
          })
          
          if (updatedFields.length > 0 && allCreatedFieldsFound) {
            break
          }
        }
        await new Promise(resolve => setTimeout(resolve, 500))
      }
      
      if (updatedFields.length === 0) {
        throw new Error('No fields found in table. Please ensure the table has at least one field.')
      }
      
      // Log created field mappings for debugging
      console.log('Created field mappings:', createdFieldNames)
      console.log('Available fields:', updatedFields.map((f: TableField) => f.name))

      // Create a set of valid field names (these should match column names in Supabase)
      // Field names are sanitized when created, so they match the actual column names
      const validFieldNames = new Set(updatedFields.map((f: TableField) => f.name))
      
      // Also include standard columns that always exist
      validFieldNames.add('id')
      validFieldNames.add('created_at')
      validFieldNames.add('updated_at')

      // Use already parsed CSV data (allRows was created above)

      // Validate that all CSV headers are either mapped or have new fields defined
      const unmappedHeaders = csvHeaders.filter(header => {
        const mappedField = fieldMappings[header]
        const hasNewField = newFields[header]
        return !mappedField && !hasNewField
      })

      if (unmappedHeaders.length > 0) {
        throw new Error(
          `The following CSV columns are not mapped to fields: ${unmappedHeaders.join(', ')}. ` +
          `Please map them to existing fields or create new fields for them.`
        )
      }

      // Map and insert rows - only include columns that exist in the table
      const rowsToInsert = allRows.map((csvRow) => {
        const mappedRow: Record<string, any> = {}
        csvHeaders.forEach((csvHeader) => {
          // Determine the field name: either from mapping or from new field creation
          // When a new field is created, it uses the CSV header name (sanitized)
          const mappedFieldName = fieldMappings[csvHeader]
          const isNewField = !mappedFieldName && newFields[csvHeader]
          
          // Find the field - either by mapped name or by CSV header name (for new fields)
          let field: TableField | undefined
          if (mappedFieldName) {
            field = updatedFields.find((f: TableField) => f.name === mappedFieldName)
          } else if (isNewField) {
            // For new fields, use the sanitized name we tracked during creation
            const sanitizedFieldName = createdFieldNames[csvHeader] || sanitizeFieldName(csvHeader)
            field = updatedFields.find((f: TableField) => f.name === sanitizedFieldName)
            
            // If still not found, try case-insensitive match as fallback
            if (!field) {
              field = updatedFields.find((f: TableField) => 
                f.name.toLowerCase() === sanitizedFieldName.toLowerCase()
              )
            }
            
            // Last resort: try exact match with original CSV header (in case it's already sanitized)
            if (!field) {
              field = updatedFields.find((f: TableField) => f.name === csvHeader)
            }
            
            // If still not found, this is a critical error
            if (!field) {
              throw new Error(
                `Field "${sanitizedFieldName}" (from CSV column "${csvHeader}") was created but not found in the table. ` +
                `This may be a schema cache issue. Please try again in a few seconds. ` +
                `Available fields: ${updatedFields.map((f: TableField) => f.name).join(', ')}`
              )
            }
          }
          
          if (!field) {
            // Field not found - this should not happen for mapped fields
            throw new Error(
              `Field not found for CSV column "${csvHeader}" (mapped to: ${mappedFieldName || 'new field'}). ` +
              `Available fields: ${updatedFields.map((f: TableField) => f.name).join(', ')}`
            )
          }

          // Verify the field name is valid (should match column name in Supabase)
          if (!validFieldNames.has(field.name)) {
            console.warn(`Field ${field.name} is not in valid fields list, skipping`)
            return // Skip this field
          }
          
          let value: any = csvRow[csvHeader]
          
          // Skip if value is empty and field is not required
          if ((value === null || value === undefined || value === '') && !field.required) {
            return // Skip this field
          }
          
          // Type conversion
          if (field.type === "number" || field.type === "currency" || field.type === "percent") {
            value = value === '' || value === null ? null : (parseFloat(value) || 0)
          } else if (field.type === "checkbox") {
            value = value === '' || value === null ? false : (value.toLowerCase() === "true" || value === "1" || value.toLowerCase() === "yes")
          } else if (field.type === "date") {
            // Try to parse date - handle various formats
            if (value === '' || value === null) {
              value = null
            } else {
              const date = new Date(value)
              if (isNaN(date.getTime())) {
                value = null
              } else {
                // Return ISO string for timestamptz
                value = date.toISOString()
              }
            }
          } else if (field.type === "multi_select") {
            // Convert comma/semicolon-separated values to array
            if (value === '' || value === null) {
              value = []
            } else {
              const parts = String(value).split(/[,;]/).map(p => p.trim()).filter(p => p)
              value = parts
            }
          } else if (field.type === "single_select") {
            // Single select is just a string
            value = value === '' || value === null ? null : String(value).trim()
          } else {
            // For text fields, convert to string or null
            value = value === '' || value === null ? null : String(value)
          }
          
          // Use field.name which should match the sanitized column name in Supabase
          // Field names are sanitized when created, so they match column names
          mappedRow[field.name] = value
        })
        return mappedRow
      })

      // Insert in batches
      const batchSize = 100
      let imported = 0
      for (let i = 0; i < rowsToInsert.length; i += batchSize) {
        const batch = rowsToInsert.slice(i, i + batchSize)
        const { error } = await supabase
          .from(supabaseTableName)
          .insert(batch)

        if (error) {
          console.error("Error inserting batch:", error)
          // Provide more helpful error message
          if (error.message?.includes('column') && error.message?.includes('schema cache')) {
            const columnMatch = error.message.match(/column ['"]([^'"]+)['"]/)
            const columnName = columnMatch ? columnMatch[1] : 'unknown'
            throw new Error(
              `Column "${columnName}" does not exist in table "${supabaseTableName}". ` +
              `Please create a field for this column first, or map it to an existing field. ` +
              `Original error: ${error.message}`
            )
          }
          throw error
        }

        imported += batch.length
        setImportedCount(imported)
      }

      setStep("complete")
      onImportComplete()
    } catch (error) {
      console.error("Error importing CSV:", error)
      alert("Failed to import CSV: " + (error as Error).message)
      setStep("mapping")
    }
  }

  return (
    <div className="space-y-4">
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
                            {field.name} ({FIELD_TYPES.find(t => t.type === field.type)?.label})
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
            <div className="overflow-x-auto max-h-64">
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
                            <span>{mappedField || header}</span>
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
                  {csvRows.slice(0, 10).map((row, idx) => (
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
    </div>
  )
}
