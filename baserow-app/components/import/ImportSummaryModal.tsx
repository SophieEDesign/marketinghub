"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ChevronDown, ChevronUp, Download, CheckCircle, XCircle, AlertCircle } from "lucide-react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"

interface ImportSummaryModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  totalRows: number
  importedRows: number
  skippedRows: number
  primaryKeyField: string
  skippedDetails?: Array<{ row: Record<string, any>; reason: string; value: any }>
}

export default function ImportSummaryModal({
  open,
  onOpenChange,
  totalRows,
  importedRows,
  skippedRows,
  primaryKeyField,
  skippedDetails = [],
}: ImportSummaryModalProps) {
  const [showDetails, setShowDetails] = useState(false)

  // Prepare CSV data for download
  function downloadSkippedCSV() {
    if (skippedDetails.length === 0) return

    // Get all unique keys from skipped rows
    const allKeys = new Set<string>()
    skippedDetails.forEach(({ row }) => {
      Object.keys(row).forEach(key => allKeys.add(key))
    })

    const headers = Array.from(allKeys)
    
    // Create CSV content
    const csvRows = [
      headers.join(','),
      ...skippedDetails.map(({ row, reason, value }) => {
        return headers.map(header => {
          const cellValue = row[header] || ''
          // Escape quotes and wrap in quotes if contains comma or quote
          const escaped = String(cellValue).replace(/"/g, '""')
          return `"${escaped}"`
        }).join(',')
      })
    ]

    const csvContent = csvRows.join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `skipped_rows_${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Group skipped rows by reason
  const skippedByReason = skippedDetails.reduce((acc, item) => {
    if (!acc[item.reason]) {
      acc[item.reason] = []
    }
    acc[item.reason].push(item)
    return acc
  }, {} as Record<string, typeof skippedDetails>)

  const duplicateCount = skippedByReason.duplicate?.length || 0
  const emptyKeyCount = skippedByReason.empty_primary_key?.length || 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Summary</DialogTitle>
          <DialogDescription>
            CSV import completed. Review the results below.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 border rounded-lg">
              <div className="text-sm text-muted-foreground">Total Rows</div>
              <div className="text-2xl font-bold mt-1">{totalRows}</div>
            </div>
            <div className="p-4 border rounded-lg bg-green-50 border-green-200">
              <div className="text-sm text-muted-foreground flex items-center gap-1">
                <CheckCircle className="h-4 w-4 text-green-600" />
                Imported
              </div>
              <div className="text-2xl font-bold mt-1 text-green-700">{importedRows}</div>
            </div>
            <div className="p-4 border rounded-lg bg-yellow-50 border-yellow-200">
              <div className="text-sm text-muted-foreground flex items-center gap-1">
                <AlertCircle className="h-4 w-4 text-yellow-600" />
                Skipped
              </div>
              <div className="text-2xl font-bold mt-1 text-yellow-700">{skippedRows}</div>
            </div>
          </div>

          {/* Primary Key Field Info */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="text-sm font-medium text-blue-900">
              Duplicate Detection Field
            </div>
            <div className="text-sm text-blue-700 mt-1">
              Using <code className="bg-blue-100 px-1 py-0.5 rounded">{primaryKeyField}</code> to identify duplicates
            </div>
          </div>

          {/* Skipped Rows Details */}
          {skippedRows > 0 && (
            <div className="space-y-2">
              <Collapsible open={showDetails} onOpenChange={setShowDetails}>
                <CollapsibleTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-between"
                    type="button"
                  >
                    <span>
                      View Skipped Rows ({skippedRows})
                      {duplicateCount > 0 && ` • ${duplicateCount} duplicates`}
                      {emptyKeyCount > 0 && ` • ${emptyKeyCount} empty keys`}
                    </span>
                    {showDetails ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2">
                  <div className="border rounded-lg p-4 max-h-96 overflow-y-auto">
                    <div className="space-y-3">
                      {/* Duplicates */}
                      {duplicateCount > 0 && (
                        <div>
                          <div className="text-sm font-medium text-yellow-800 mb-2">
                            Duplicates ({duplicateCount})
                          </div>
                          <div className="space-y-1">
                            {skippedByReason.duplicate?.slice(0, 50).map((item, idx) => (
                              <div
                                key={idx}
                                className="text-sm p-2 bg-yellow-50 rounded border border-yellow-200"
                              >
                                <span className="font-mono text-yellow-900">
                                  {String(item.value)}
                                </span>
                                <span className="text-yellow-700 ml-2">
                                  (already exists in database)
                                </span>
                              </div>
                            ))}
                            {duplicateCount > 50 && (
                              <div className="text-sm text-muted-foreground italic">
                                ... and {duplicateCount - 50} more duplicates
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Empty Keys */}
                      {emptyKeyCount > 0 && (
                        <div>
                          <div className="text-sm font-medium text-orange-800 mb-2">
                            Empty Primary Key ({emptyKeyCount})
                          </div>
                          <div className="space-y-1">
                            {skippedByReason.empty_primary_key?.slice(0, 50).map((item, idx) => (
                              <div
                                key={idx}
                                className="text-sm p-2 bg-orange-50 rounded border border-orange-200"
                              >
                                <span className="text-orange-700">
                                  Row {idx + 1}: Empty or missing value in <code className="bg-orange-100 px-1 py-0.5 rounded">{primaryKeyField}</code>
                                </span>
                              </div>
                            ))}
                            {emptyKeyCount > 50 && (
                              <div className="text-sm text-muted-foreground italic">
                                ... and {emptyKeyCount - 50} more rows with empty keys
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {skippedDetails.length > 0 && (
                    <div className="mt-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={downloadSkippedCSV}
                        className="w-full"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download Skipped Rows as CSV
                      </Button>
                    </div>
                  )}
                </CollapsibleContent>
              </Collapsible>
            </div>
          )}

          {/* Success Message */}
          {importedRows > 0 && skippedRows === 0 && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2 text-green-800">
                <CheckCircle className="h-5 w-5" />
                <span className="font-medium">
                  All {importedRows} rows imported successfully!
                </span>
              </div>
            </div>
          )}

          {/* Warning Message */}
          {skippedRows > 0 && (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center gap-2 text-yellow-800">
                <AlertCircle className="h-5 w-5" />
                <span className="font-medium">
                  {importedRows} rows imported, {skippedRows} rows skipped
                </span>
              </div>
              <div className="text-sm text-yellow-700 mt-2">
                Skipped rows were not imported to prevent duplicates. Expand the details above to see which rows were skipped.
              </div>
            </div>
          )}

          {/* Close Button */}
          <div className="flex justify-end pt-4">
            <Button onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

