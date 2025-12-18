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

      for (const fieldData of fieldsToCreate) {
        await fetch(`/api/tables/${tableId}/fields`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(fieldData),
        })
      }

      // Reload fields to get new field IDs
      await loadFields()
      const updatedFields = await fetch(`/api/tables/${tableId}/fields`).then(r => r.json()).then(d => d.fields || [])

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

      // Map and insert rows
      const rowsToInsert = allRows.map((csvRow) => {
        const mappedRow: Record<string, any> = {}
        csvHeaders.forEach((csvHeader) => {
          const fieldName = fieldMappings[csvHeader] || csvHeader
          const field = updatedFields.find((f: TableField) => f.name === fieldName)
          if (field) {
            let value: any = csvRow[csvHeader]
            
            // Type conversion
            if (field.type === "number" || field.type === "currency" || field.type === "percent") {
              value = parseFloat(value) || 0
            } else if (field.type === "checkbox") {
              value = value.toLowerCase() === "true" || value === "1" || value.toLowerCase() === "yes"
            } else if (field.type === "date") {
              // Try to parse date
              const date = new Date(value)
              value = isNaN(date.getTime()) ? null : date.toISOString()
            }
            
            mappedRow[fieldName] = value
          }
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
