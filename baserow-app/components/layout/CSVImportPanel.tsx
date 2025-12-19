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
    headers.forEach((header) => {
      const matchingField = tableFields.find(
        (f) => f.name.toLowerCase() === header.toLowerCase()
      )
      if (matchingField) {
        mappings[header] = matchingField.name
      }
    })
    setFieldMappings(mappings)

    setStep("mapping")
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
      const fieldsToCreate: Array<{ name: string; type: FieldType }> = []
      csvHeaders.forEach((header) => {
        if (!fieldMappings[header] && newFields[header]) {
          fieldsToCreate.push({
            name: header,
            type: newFields[header],
          })
        }
      })

      // Create new fields and wait for them to be created
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
      }

      // Reload fields to get new field IDs - wait a bit for database to update
      await new Promise(resolve => setTimeout(resolve, 500))
      await loadFields()
      const updatedFieldsResponse = await fetch(`/api/tables/${tableId}/fields`)
      if (!updatedFieldsResponse.ok) {
        throw new Error('Failed to reload fields after creation')
      }
      const updatedFields = await updatedFieldsResponse.json().then(d => d.fields || [])
      
      if (updatedFields.length === 0) {
        throw new Error('No fields found in table. Please ensure the table has at least one field.')
      }

      // Create a set of valid field names (these should match column names in Supabase)
      // Field names are sanitized when created, so they match the actual column names
      const validFieldNames = new Set(updatedFields.map((f: TableField) => f.name))
      
      // Also include standard columns that always exist
      validFieldNames.add('id')
      validFieldNames.add('created_at')
      validFieldNames.add('updated_at')

      // Parse full CSV
      const file = fileInputRef.current?.files?.[0]
      if (!file) return

      const text = await file.text()
      const lines = text.split("\n").filter(line => line.trim())
      const allRows: CSVRow[] = []

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
      for (let i = 1; i < lines.length; i++) {
        const values = parseLine(lines[i])
        const row: CSVRow = {}
        headers.forEach((header, index) => {
          row[header] = values[index] || ""
        })
        allRows.push(row)
      }

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
            // For new fields, the field name is the sanitized version of the CSV header
            // The API sanitizes field names when creating them, so we need to match by sanitized name
            const sanitizedHeader = sanitizeFieldName(csvHeader)
            field = updatedFields.find((f: TableField) => f.name === sanitizedHeader)
            
            // If still not found, try case-insensitive match as fallback
            if (!field) {
              field = updatedFields.find((f: TableField) => 
                f.name.toLowerCase() === sanitizedHeader.toLowerCase()
              )
            }
          }
          
          if (!field) {
            // Field not found - skip this column
            console.warn(`Field not found for CSV column "${csvHeader}" (mapped: ${mappedFieldName || 'new field'})`)
            return
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
            // Try to parse date
            if (value === '' || value === null) {
              value = null
            } else {
              const date = new Date(value)
              value = isNaN(date.getTime()) ? null : date.toISOString()
            }
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
            <label htmlFor="csv-upload">
              <Button variant="outline" className="cursor-pointer">
                <FileText className="h-4 w-4 mr-2" />
                Choose CSV File
              </Button>
            </label>
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
                    <Label className="text-xs font-medium text-gray-700">
                      {csvHeader}
                    </Label>
                    <span className="text-xs text-gray-500">
                      Sample: {csvRows[0]?.[csvHeader]?.substring(0, 30) || "—"}
                    </span>
                  </div>
                  <div className="space-y-2">
                    <Select
                      value={mappedField || "new"}
                      onValueChange={(value) => {
                        if (value === "new") {
                          setFieldMappings((prev) => {
                            const newMappings = { ...prev }
                            delete newMappings[csvHeader]
                            return newMappings
                          })
                        } else {
                          handleMappingChange(csvHeader, value)
                        }
                      }}
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue placeholder="Select or create field" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="new">Create new field</SelectItem>
                        {tableFields.map((field) => (
                          <SelectItem key={field.id} value={field.name}>
                            {field.name} ({FIELD_TYPES.find(t => t.type === field.type)?.label})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {!mappedField && (
                      <Select
                        value={newFields[csvHeader] || "text"}
                        onValueChange={(value) => handleNewFieldType(csvHeader, value as FieldType)}
                      >
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FIELD_TYPES.filter(ft => !ft.isVirtual).map((ft) => (
                            <SelectItem key={ft.type} value={ft.type}>
                              {ft.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
              Review the first 10 rows before importing
            </p>
          </div>

          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto max-h-64">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {csvHeaders.map((header) => (
                      <th key={header} className="px-2 py-2 text-left font-medium text-gray-700">
                        {fieldMappings[header] || header}
                      </th>
                    ))}
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
              Back
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
