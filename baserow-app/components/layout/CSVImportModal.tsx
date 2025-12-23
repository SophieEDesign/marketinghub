"use client"

import { useState, useRef, useEffect, useCallback } from "react"
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
  const [status, setStatus] = useState<ImportStatus>('idle')
  const [file, setFile] = useState<File | null>(null)
  const [parsedData, setParsedData] = useState<ParsedCSV | null>(null)
  const [tableFields, setTableFields] = useState<TableField[]>([])
  const [fieldMappings, setFieldMappings] = useState<Record<string, string>>({}) // CSV column -> field name
  const [newFieldTypes, setNewFieldTypes] = useState<Record<string, FieldType>>({}) // CSV column -> field type
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

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!open) {
      setStatus('idle')
      setFile(null)
      setParsedData(null)
      setError(null)
      setProgress("")
      setImportedCount(0)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    } else {
      loadTableFields()
    }
  }, [open, tableId, loadTableFields])

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
      setStatus('mapping')
      setProgress('')
    } catch (err: any) {
      setError(err.message || 'Failed to parse CSV file')
      setStatus('error')
      setFile(null)
      setProgress('')
    }
  }, [])

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

    setStatus('importing')
    setError(null)
    setImportedCount(0)

    try {
      // Phase 1: Map CSV columns to existing fields or create new ones
      setProgress('Mapping columns to fields...')
      
      const columnMappings: Record<string, string> = {} // CSV column name -> field name
      const fieldsToCreate: Array<{ name: string; type: string }> = [] // CSV column names and detected types

      // Map CSV parser types to system field types
      const mapCSVTypeToFieldType = (csvType: 'text' | 'number' | 'boolean' | 'date'): string => {
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

      // Auto-map columns to existing fields by name match
      parsedData.columns.forEach((col) => {
        const sanitizedColName = sanitizeFieldNameSafe(col.name)
        const existingField = tableFields.find(
          (f) => f.name.toLowerCase() === sanitizedColName.toLowerCase()
        )
        
        if (existingField) {
          columnMappings[col.name] = existingField.name
        } else {
          fieldsToCreate.push({
            name: col.name,
            type: mapCSVTypeToFieldType(col.type)
          })
        }
      })

      // Phase 2: Create new fields with auto-detected types
      if (fieldsToCreate.length > 0) {
        setProgress(`Creating ${fieldsToCreate.length} new fields...`)
        
        for (const fieldInfo of fieldsToCreate) {
          const sanitizedName = sanitizeFieldNameSafe(fieldInfo.name)
          
          const response = await fetch(`/api/tables/${tableId}/fields`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: sanitizedName,
              type: fieldInfo.type, // Use user-selected type
              required: false,
            }),
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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
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

          {/* Preview */}
          {status === 'preview' && parsedData && (
            <div className="space-y-6">
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">Preview</h3>
                <p className="text-sm text-muted-foreground">
                  Review the data before importing. {parsedData.rows.length} rows will be imported.
                </p>
                <div className="border rounded-lg overflow-hidden">
                  <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b sticky top-0 z-10">
                        <tr>
                          {parsedData.columns.map((col) => {
                            const sanitizedColName = sanitizeFieldNameSafe(col.name)
                            const existingField = tableFields.find(
                              (f) => f.name.toLowerCase() === sanitizedColName.toLowerCase()
                            )
                            const detectedType = col.type === 'boolean' ? 'checkbox' : col.type
                            return (
                              <th key={col.name} className="px-4 py-2 text-left font-semibold text-gray-700 bg-gray-50">
                                <div className="flex flex-col">
                                  <span>{col.name}</span>
                                  <span className="text-xs font-normal text-gray-500">
                                    {existingField ? `→ ${existingField.name} (${existingField.type})` : `→ New field (${detectedType})`}
                                  </span>
                                  <span className="text-xs text-gray-400">Detected: {col.type}</span>
                                </div>
                              </th>
                            )
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {parsedData.previewRows.map((row, idx) => (
                          <tr key={idx} className="border-b hover:bg-gray-50">
                            {parsedData.columns.map((col) => (
                              <td key={col.name} className="px-4 py-2">
                                {String(row[col.name] || '').substring(0, 50)}
                              </td>
                            ))}
                          </tr>
                        ))}
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
                  disabled={parsedData.rows.length === 0}
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
