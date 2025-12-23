"use client"

import { useState, useRef, useEffect } from "react"
import { Upload, FileText, Check, X, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { supabase } from "@/lib/supabase/client"
import type { TableField } from "@/types/fields"
import { sanitizeFieldName } from "@/lib/fields/validation"

interface CSVImportModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tableId: string
  tableName: string
  supabaseTableName: string
  onImportComplete: () => void
}

type ImportPhase = "idle" | "parsing" | "mapping_fields" | "creating_fields" | "inserting_rows" | "completed" | "error"

interface CSVRow {
  [key: string]: string
}

export default function CSVImportModal({
  open,
  onOpenChange,
  tableId,
  tableName,
  supabaseTableName,
  onImportComplete,
}: CSVImportModalProps) {
  const [phase, setPhase] = useState<ImportPhase>("idle")
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [csvRows, setCsvRows] = useState<CSVRow[]>([])
  const [tableFields, setTableFields] = useState<TableField[]>([])
  const [fieldMappings, setFieldMappings] = useState<Record<string, string>>({})
  const [newFields, setNewFields] = useState<Record<string, boolean>>({}) // Just track which headers need new fields
  const [importedCount, setImportedCount] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [progressMessage, setProgressMessage] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!open) {
      setPhase("idle")
      setCsvHeaders([])
      setCsvRows([])
      setFieldMappings({})
      setNewFields({})
      setImportedCount(0)
      setError(null)
      setProgressMessage("")
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    } else {
      loadTableFields()
    }
  }, [open, tableId])

  async function loadTableFields() {
    try {
      const response = await fetch(`/api/tables/${tableId}/fields`)
      if (response.ok) {
        const data = await response.json()
        setTableFields(data.fields || [])
      }
    } catch (error) {
      console.error("Error loading fields:", error)
    }
  }

  function parseCSV(text: string): { headers: string[]; rows: CSVRow[] } {
    const lines = text.split("\n").filter(line => line.trim())
    if (lines.length === 0) return { headers: [], rows: [] }

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

    for (let i = 1; i < lines.length; i++) {
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
    setPhase("parsing")
    setProgressMessage("Parsing CSV file...")

    try {
      const text = await file.text()
      const { headers, rows } = parseCSV(text)

      if (headers.length === 0) {
        throw new Error("CSV file appears to be empty or invalid")
      }

      setCsvHeaders(headers)
      setCsvRows(rows)

      // Auto-map headers to existing fields
      const mappings: Record<string, string> = {}
      const needsNewFields: Record<string, boolean> = {}

      headers.forEach((header) => {
        const sanitized = sanitizeFieldName(header)
        const existingField = tableFields.find(
          (f) => f.name.toLowerCase() === sanitized.toLowerCase()
        )
        if (existingField) {
          mappings[header] = existingField.name
        } else {
          needsNewFields[header] = true
        }
      })

      setFieldMappings(mappings)
      setNewFields(needsNewFields)
      setPhase("mapping_fields")
      setProgressMessage("")
    } catch (err) {
      setError(`Failed to read CSV file: ${(err as Error).message}`)
      setPhase("error")
      setProgressMessage("")
    }
  }

  async function handleImport() {
    if (csvHeaders.length === 0 || csvRows.length === 0) {
      setError("Please upload a CSV file first")
      setPhase("error")
      return
    }

    setError(null)
    setImportedCount(0)

    try {
      // Phase 1: Create new fields (all as 'text' type)
      setPhase("creating_fields")
      setProgressMessage("Creating new fields...")

      const fieldsToCreate = csvHeaders.filter(h => newFields[h] && !fieldMappings[h])
      const createdFieldNames: Record<string, string> = {}

      for (const header of fieldsToCreate) {
        const sanitizedName = sanitizeFieldName(header)
        
        const response = await fetch(`/api/tables/${tableId}/fields`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: sanitizedName,
            type: "text", // Always default to text
            required: false,
          }),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
          throw new Error(`Failed to create field "${header}": ${errorData.error || 'Unknown error'}`)
        }

        const createdField = await response.json().catch(() => null)
        if (createdField?.field?.name) {
          createdFieldNames[header] = createdField.field.name
          fieldMappings[header] = createdField.field.name
        }
      }

      // Reload fields to get updated list
      await loadTableFields()

      // Phase 2: Prepare rows for insertion
      setPhase("inserting_rows")
      setProgressMessage("Preparing rows for insertion...")

      // Get updated field list
      const response = await fetch(`/api/tables/${tableId}/fields`)
      const fieldsData = await response.ok ? await response.json() : { fields: [] }
      const updatedFields = fieldsData.fields || []

      if (updatedFields.length === 0) {
        throw new Error('No fields found in table. Please ensure the table has at least one field.')
      }

      // Map CSV rows to database format
      const rowsToInsert = csvRows
        .map((csvRow) => {
          const mappedRow: Record<string, any> = {}
          
          csvHeaders.forEach((csvHeader) => {
            const mappedFieldName = fieldMappings[csvHeader]
            if (!mappedFieldName) return // Skip unmapped columns

            const field = updatedFields.find((f: TableField) => f.name === mappedFieldName)
            if (!field) return // Skip if field not found

            let value: any = csvRow[csvHeader]
            
            // Convert empty strings to null
            if (value === '') {
              value = null
            }

            // Type conversion based on field type
            if (field.type === "number" || field.type === "currency" || field.type === "percent") {
              value = value === null ? null : (parseFloat(value) || 0)
            } else if (field.type === "checkbox") {
              value = value === null ? false : (value.toLowerCase() === "true" || value === "1" || value.toLowerCase() === "yes")
            } else if (field.type === "date") {
              if (value === null) {
                value = null
              } else {
                const date = new Date(value)
                value = isNaN(date.getTime()) ? null : date.toISOString()
              }
            } else if (field.type === "multi_select") {
              if (value === null) {
                value = []
              } else {
                value = String(value).split(/[,;]/).map(p => p.trim()).filter(p => p)
              }
            } else {
              // For text and other types, convert to string or null
              value = value === null ? null : String(value).trim()
            }

            mappedRow[field.name] = value
          })

          return mappedRow
        })
        .filter(row => Object.keys(row).length > 0) // Filter out completely empty rows

      // Validate we have rows to insert
      if (rowsToInsert.length === 0) {
        throw new Error(
          `No valid rows to import. ` +
          `Total CSV rows: ${csvRows.length}, ` +
          `Mapped columns: ${Object.keys(fieldMappings).length}/${csvHeaders.length}. ` +
          `Please ensure at least one column is mapped and contains data.`
        )
      }

      // Phase 3: Insert rows in batches
      setProgressMessage(`Inserting ${rowsToInsert.length} rows...`)

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
          console.error("❌ Error inserting batch:", insertError)
          console.error("Batch size:", batch.length)
          console.error("Batch sample:", JSON.stringify(batch[0], null, 2))
          console.error("Supabase table:", supabaseTableName)
          console.error("Available fields:", updatedFields.map((f: TableField) => f.name))

          // Provide helpful error messages
          if (insertError.message?.includes('column') || insertError.code === '42703' || insertError.code === '42P01' || insertError.code === 'PGRST116') {
            const columnMatch = insertError.message?.match(/column ['"]([^'"]+)['"]/)
            const columnName = columnMatch ? columnMatch[1] : 'unknown'
            throw new Error(
              `Column "${columnName}" does not exist in table "${supabaseTableName}". ` +
              `Available fields: ${updatedFields.map((f: TableField) => f.name).join(', ')}. ` +
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

        // Count inserted rows from response
        const insertedCount = insertedData?.length || batch.length
        totalImported += insertedCount
        setImportedCount(totalImported)
        setProgressMessage(`Inserted ${totalImported} of ${rowsToInsert.length} rows...`)
      }

      // Success - ensure we have imported rows
      if (totalImported === 0) {
        throw new Error("No rows were imported. Please check your data and field mappings.")
      }

      setPhase("completed")
      setProgressMessage(`Successfully imported ${totalImported} rows`)
      setImportedCount(totalImported)

      // Refresh grid immediately
      onImportComplete()

      // Close modal after short delay
      setTimeout(() => {
        onOpenChange(false)
      }, 2000)

    } catch (err) {
      console.error("❌ Error importing CSV:", err)
      const errorMessage = err instanceof Error ? err.message : String(err)
      setError(`Failed to import CSV: ${errorMessage}`)
      setPhase("error")
      setProgressMessage("")
      setImportedCount(0)
    }
  }

  function getPhaseMessage() {
    switch (phase) {
      case "parsing":
        return "Parsing CSV file..."
      case "mapping_fields":
        return "Map CSV columns to fields"
      case "creating_fields":
        return progressMessage || "Creating new fields..."
      case "inserting_rows":
        return progressMessage || "Inserting rows..."
      case "completed":
        return `Successfully imported ${importedCount} rows!`
      case "error":
        return "Import failed"
      default:
        return "Upload a CSV file to get started"
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import CSV to {tableName}</DialogTitle>
          <DialogDescription>
            Import data from a CSV file. All new fields will be created as text type.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <div>{error}</div>
            </div>
          )}

          {/* Phase: Upload */}
          {phase === "idle" && (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <Label htmlFor="csv-file" className="cursor-pointer">
                  <span className="text-sm font-medium text-gray-700">
                    Click to upload CSV file
                  </span>
                </Label>
                <Input
                  id="csv-file"
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <p className="text-xs text-gray-500 mt-2">
                  Supports standard CSV format
                </p>
              </div>
            </div>
          )}

          {/* Phase: Parsing */}
          {phase === "parsing" && (
            <div className="text-center py-8 space-y-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-sm text-gray-600">{getPhaseMessage()}</p>
            </div>
          )}

          {/* Phase: Mapping Fields */}
          {phase === "mapping_fields" && (
            <div className="space-y-4">
              <div className="text-sm text-gray-600">
                Map CSV columns to existing fields or create new ones (all new fields will be text type).
              </div>
              <div className="space-y-2 max-h-96 overflow-y-auto border rounded-lg p-4">
                {csvHeaders.map((header) => {
                  const mappedField = fieldMappings[header]
                  const needsNew = newFields[header]

                  return (
                    <div key={header} className="flex items-center gap-2">
                      <div className="flex-1 text-sm font-medium">{header}</div>
                      <Select
                        value={mappedField || (needsNew ? "__new__" : "")}
                        onValueChange={(value) => {
                          if (value === "__new__") {
                            setNewFields({ ...newFields, [header]: true })
                            setFieldMappings({ ...fieldMappings, [header]: "" })
                          } else if (value === "") {
                            setNewFields({ ...newFields, [header]: false })
                            setFieldMappings({ ...fieldMappings, [header]: "" })
                          } else {
                            setNewFields({ ...newFields, [header]: false })
                            setFieldMappings({ ...fieldMappings, [header]: value })
                          }
                        }}
                      >
                        <SelectTrigger className="w-48">
                          <SelectValue placeholder="Select field" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Skip column</SelectItem>
                          <SelectItem value="__new__">Create new field (text)</SelectItem>
                          {tableFields.map((field) => (
                            <SelectItem key={field.id} value={field.name}>
                              {field.name} ({field.type})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )
                })}
              </div>
              <Button onClick={handleImport} className="w-full" disabled={Object.keys(fieldMappings).length === 0}>
                Start Import
              </Button>
            </div>
          )}

          {/* Phase: Creating Fields / Inserting Rows */}
          {(phase === "creating_fields" || phase === "inserting_rows") && (
            <div className="text-center py-8 space-y-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-sm font-medium text-gray-900">{getPhaseMessage()}</p>
              {importedCount > 0 && (
                <p className="text-xs text-gray-500">{importedCount} rows imported so far</p>
              )}
            </div>
          )}

          {/* Phase: Completed */}
          {phase === "completed" && (
            <div className="text-center py-8 space-y-4">
              <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <Check className="h-6 w-6 text-green-600" />
              </div>
              <p className="text-sm font-medium text-gray-900">{getPhaseMessage()}</p>
            </div>
          )}

          {/* Phase: Error */}
          {phase === "error" && (
            <div className="space-y-4">
              <div className="text-center py-4">
                <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
                <p className="text-sm font-medium text-gray-900">Import failed</p>
              </div>
              <Button onClick={() => setPhase("mapping_fields")} variant="outline" className="w-full">
                Try Again
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
