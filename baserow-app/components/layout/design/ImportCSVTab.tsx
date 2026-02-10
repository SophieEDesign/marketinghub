"use client"

import { memo, useState } from "react"
import CSVImportModal from "@/components/layout/CSVImportModal"
import { FileText, Download } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ImportCSVTabProps {
  tableId: string
  tableName: string
  supabaseTableName: string
  onImportComplete: () => void
}

const ImportCSVTab = memo(function ImportCSVTab({
  tableId,
  tableName,
  supabaseTableName,
  onImportComplete,
}: ImportCSVTabProps) {
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [exporting, setExporting] = useState(false)

  async function handleExportCsv() {
    try {
      setExporting(true)
      const res = await fetch(`/api/tables/${tableId}/export-csv`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to export CSV")
      }
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${tableName || "table"}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (error: any) {
      console.error("Error exporting CSV:", error)
      alert(error.message || "Failed to export CSV")
    } finally {
      setExporting(false)
    }
  }

  return (
    <>
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-2">Import CSV</h3>
          <p className="text-xs text-muted-foreground mb-4">
            Import data from a CSV file into this table. New fields will be created automatically.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Button
            onClick={() => setImportModalOpen(true)}
            variant="outline"
            className="w-full"
          >
            <FileText className="h-4 w-4 mr-2" />
            Import CSV File
          </Button>
          <Button
            onClick={handleExportCsv}
            variant="outline"
            className="w-full"
            disabled={exporting}
          >
            <Download className="h-4 w-4 mr-2" />
            {exporting ? "Exporting…" : "Export CSV"}
          </Button>
        </div>

        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-xs text-blue-800">
            <strong>Tip:</strong> Make sure your CSV has a header row. Field types will be auto-detected based on the data.
          </p>
        </div>
      </div>

      <CSVImportModal
        open={importModalOpen}
        onOpenChange={setImportModalOpen}
        tableId={tableId}
        tableName={tableName}
        supabaseTableName={supabaseTableName}
        onImportComplete={onImportComplete}
      />
    </>
  )
})

export default ImportCSVTab
