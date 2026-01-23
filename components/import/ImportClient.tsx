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
  const [ignoredColumns, setIgnoredColumns] = useState<Record<string, boolean>>({})
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
      setIgnoredColumns({})
      
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

    const includedColumns = parsedData.columns.filter(col => !ignoredColumns[col.name])
    if (includedColumns.length === 0) {
      setError('Please select at least one column to import (uncheck “Ignore” on a column).')
      return
    }

    setStatus('importing')
    setError(null)
    setProgress('Creating table structure...')

    try {
      // 1. Create Supabase table
      const createResult = await createSupabaseTable(
        sanitizedName,
        includedColumns.map(col => ({
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
      const columnTypes: Record<string, 'text' | 'number' | 'boolean' | 'date' | 'single_select' | 'multi_select'> = {}
      const columnNameMap: Record<string, string> = {}
      includedColumns.forEach(col => {
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
        includedColumns,
        parsedData.rows
      )

      if (!metadataResult.success) {
        throw new Error(metadataResult.error || 'Failed to create metadata')
      }

      setStatus('success')
      setProgress('')

      // Redirect after a short delay
      setTimeout(() => {
        const href =
          metadataResult.tableId && metadataResult.viewId
            ? `/tables/${metadataResult.tableId}/views/${metadataResult.viewId}`
            : '/tables'

        router.push(href)
        // Force a route refresh so the destination page fetches fresh rows/fields immediately.
        router.refresh()
        // Extra safety: refresh again shortly after navigation completes.
        setTimeout(() => router.refresh(), 250)
      }, 2000)
    } catch (err: any) {
      setError(err.message || 'Failed to import table')
      setStatus('error')
      setProgress('')
    }
  }, [parsedData, tableName, router])

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* File Upload Area */}
      {status === 'idle' || status === 'error' ? (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:border-blue-500 transition-colors cursor-pointer"
          onClick={() => document.getElementById('file-input')?.click()}
        >
          <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Drop CSV file here or click to browse</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Supports CSV files exported from Airtable or any standard CSV format
          </p>
          <input
            id="file-input"
            type="file"
            accept=".csv"
            onChange={handleFileInput}
            className="hidden"
          />
          <button className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90">
            <FileText className="h-4 w-4 inline mr-2" />
            Choose CSV File
          </button>
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
            <label htmlFor="table-name" className="text-sm font-medium">
              Table Name
            </label>
            <input
              id="table-name"
              type="text"
              value={tableName}
              onChange={(e) => setTableName(e.target.value)}
              placeholder="Enter table name"
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>

          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Preview</h3>
            <p className="text-sm text-muted-foreground">
              Columns: {parsedData.columns.length} total •{' '}
              {parsedData.columns.filter(c => !ignoredColumns[c.name]).length} importing •{' '}
              {parsedData.columns.filter(c => ignoredColumns[c.name]).length} ignored
            </p>
            <div className="border rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      {parsedData.columns.map((col) => (
                        <th key={col.name} className="px-4 py-2 text-left font-semibold text-gray-700">
                          <div className="flex items-start gap-3">
                            <div className={ignoredColumns[col.name] ? "opacity-60" : ""}>
                              {col.name}
                              <span className="ml-2 text-xs text-gray-500">({col.type})</span>
                            </div>
                            <label className="ml-auto flex items-center gap-1 text-xs font-normal text-gray-600">
                              <input
                                type="checkbox"
                                checked={!!ignoredColumns[col.name]}
                                onChange={(e) =>
                                  setIgnoredColumns((prev) => ({
                                    ...prev,
                                    [col.name]: e.target.checked,
                                  }))
                                }
                              />
                              Ignore
                            </label>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {parsedData.previewRows.map((row, idx) => (
                      <tr key={idx} className="border-b hover:bg-gray-50">
                        {parsedData.columns.map((col) => (
                          <td
                            key={col.name}
                            className={
                              "px-4 py-2 " + (ignoredColumns[col.name] ? "opacity-50" : "")
                            }
                          >
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
            <button
              onClick={handleImport}
              disabled={!tableName.trim()}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
            >
              Import {parsedData.rows.length} Rows
            </button>
            <button
              onClick={() => {
                setFile(null)
                setParsedData(null)
                setTableName("")
                setStatus('idle')
                setError(null)
              }}
              className="px-4 py-2 border rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Importing Status */}
      {status === 'importing' && (
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">{progress}</p>
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
            Successfully imported {parsedData?.rows.length || 0} rows into "{tableName}"
          </p>
          <p className="text-sm text-muted-foreground">Redirecting to table...</p>
        </div>
      )}

      {/* Error */}
      {status === 'error' && error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4">
          <div className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-red-600" />
            <h3 className="font-semibold text-red-900">Import Failed</h3>
          </div>
          <p className="mt-2 text-sm text-red-700">{error}</p>
          <button
            onClick={() => {
              setFile(null)
              setParsedData(null)
              setTableName("")
              setStatus('idle')
              setError(null)
            }}
            className="mt-4 px-4 py-2 border border-red-300 rounded-md hover:bg-red-50"
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  )
}
