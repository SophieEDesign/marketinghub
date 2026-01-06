"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Upload, FileText, CheckCircle, XCircle, Loader2 } from "lucide-react"
import { parseCSV, sanitizeTableName, type ParsedCSV } from "@/lib/import/csvParser"
import { createSupabaseTable } from "@/lib/import/createSupabaseTable"
import { insertRows } from "@/lib/import/insertRows"
import { createImportMetadata } from "@/lib/import/metadata"

type ImportStatus = 'idle' | 'parsing' | 'preview' | 'importing' | 'success' | 'error'

export default function ImportClient() {
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [parsedData, setParsedData] = useState<ParsedCSV | null>(null)
  const [tableName, setTableName] = useState("")
  const [status, setStatus] = useState<ImportStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState("")

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
      
      // Auto-generate table name from filename
      const nameFromFile = sanitizeTableName(selectedFile.name.replace('.csv', ''))
      setTableName(nameFromFile)
      
      setStatus('preview')
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

  const handleImport = useCallback(async () => {
    if (!parsedData || !tableName.trim()) {
      setError('Please provide a table name')
      return
    }

    const sanitizedName = sanitizeTableName(tableName.trim())
    if (!sanitizedName) {
      setError('Invalid table name')
      return
    }

    setStatus('importing')
    setError(null)
    setProgress('Creating table structure...')

    try {
      // 1. Create Supabase table
      const createResult = await createSupabaseTable(
        sanitizedName,
        parsedData.columns.map(col => ({
          name: col.sanitizedName,
          type: col.type,
        }))
      )

      if (!createResult.success) {
        throw new Error(createResult.error || 'Failed to create table')
      }

      setProgress(`Inserting ${parsedData.rows.length} rows...`)

      // 2. Insert rows
      // Map original column names to sanitized names for type lookup
      const columnTypes: Record<string, 'text' | 'number' | 'boolean' | 'date'> = {}
      const columnNameMap: Record<string, string> = {}
      parsedData.columns.forEach(col => {
        columnTypes[col.sanitizedName] = col.type
        columnNameMap[col.name] = col.sanitizedName
      })

      const insertResult = await insertRows(
        sanitizedName,
        parsedData.rows,
        columnTypes,
        columnNameMap
      )

      if (!insertResult.success) {
        throw new Error(insertResult.error || 'Failed to insert rows')
      }

      setProgress('Creating metadata...')

      // 3. Create metadata
      const metadataResult = await createImportMetadata(
        sanitizedName,
        tableName.trim(),
        parsedData.columns
      )

      if (!metadataResult.success) {
        throw new Error(metadataResult.error || 'Failed to create metadata')
      }

      setStatus('success')
      setProgress('')

      // Redirect after a short delay
      setTimeout(() => {
        if (metadataResult.tableId && metadataResult.viewId) {
          router.push(`/tables/${metadataResult.tableId}/views/${metadataResult.viewId}`)
        } else {
          router.push('/tables')
        }
      }, 2000)
    } catch (err: any) {
      setError(err.message || 'Failed to import table')
      setStatus('error')
      setProgress('')
    }
  }, [parsedData, tableName, router])

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Import CSV Table</h1>
        <p className="text-muted-foreground">
          Upload a CSV file to create a new table in the Marketing Hub
        </p>
      </div>

      {/* File Upload Area */}
      {status === 'idle' || status === 'error' ? (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:border-blue-500 transition-colors cursor-pointer"
          onClick={() => document.getElementById('file-input')?.click()}
        >
          <input
            id="file-input"
            type="file"
            accept=".csv"
            onChange={handleFileInput}
            className="hidden"
          />
          <Upload className="h-12 w-12 mx-auto mb-4 text-gray-400" />
          <p className="text-lg font-medium mb-2">
            Drop CSV file here or click to browse
          </p>
          <p className="text-sm text-gray-500">
            Supports CSV files exported from Airtable or any standard CSV format
          </p>
        </div>
      ) : null}

      {/* Parsing Status */}
      {status === 'parsing' && (
        <div className="border rounded-lg p-8 text-center">
          <Loader2 className="h-8 w-8 mx-auto mb-4 animate-spin text-blue-600" />
          <p className="text-lg font-medium">{progress}</p>
        </div>
      )}

      {/* Preview */}
      {status === 'preview' && parsedData && (
        <div className="space-y-4">
          <div className="border rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Preview</h2>
            
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                Table Name *
              </label>
              <input
                type="text"
                value={tableName}
                onChange={(e) => setTableName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter table name"
              />
            </div>

            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">
                <strong>{parsedData.columns.length}</strong> columns,{" "}
                <strong>{parsedData.rows.length}</strong> rows
              </p>
            </div>

            {/* Column Info */}
            <div className="mb-4">
              <h3 className="text-sm font-semibold mb-2">Columns:</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                {parsedData.columns.map((col) => (
                  <div
                    key={col.sanitizedName}
                    className="p-2 bg-gray-50 rounded border"
                  >
                    <div className="font-medium">{col.name}</div>
                    <div className="text-xs text-gray-500">
                      {col.type} ({col.sanitizedName})
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Preview Table */}
            <div className="overflow-x-auto border rounded pb-3">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    {parsedData.columns.map((col) => (
                      <th
                        key={col.sanitizedName}
                        className="px-3 py-2 text-left font-semibold text-xs"
                      >
                        {col.name}
                        <div className="text-xs font-normal text-gray-500">
                          {col.type}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {parsedData.previewRows.map((row, rowIndex) => (
                    <tr key={rowIndex} className="border-b">
                      {parsedData.columns.map((col) => (
                        <td key={col.sanitizedName} className="px-3 py-2">
                          {row[col.name] !== null && row[col.name] !== undefined
                            ? String(row[col.name]).substring(0, 50)
                            : <span className="text-gray-400">—</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={handleImport}
                disabled={!tableName.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <FileText className="h-4 w-4" />
                Import Table
              </button>
              <button
                onClick={() => {
                  setFile(null)
                  setParsedData(null)
                  setTableName("")
                  setStatus('idle')
                  setError(null)
                }}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Importing Status */}
      {status === 'importing' && (
        <div className="border rounded-lg p-8 text-center">
          <Loader2 className="h-8 w-8 mx-auto mb-4 animate-spin text-blue-600" />
          <p className="text-lg font-medium mb-2">Importing table...</p>
          <p className="text-sm text-gray-600">{progress}</p>
        </div>
      )}

      {/* Success */}
      {status === 'success' && (
        <div className="border border-green-200 bg-green-50 rounded-lg p-8 text-center">
          <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-600" />
          <p className="text-lg font-medium text-green-800 mb-2">
            Table imported successfully!
          </p>
          <p className="text-sm text-green-700">
            Redirecting to your new table...
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="border border-red-200 bg-red-50 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <XCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-red-800">Error</p>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
