"use client"

import { Database, Plus } from "lucide-react"
import EmptyState from "./EmptyState"

interface EmptyTableStateProps {
  onCreateRecord?: () => void
  onImportData?: () => void
}

export default function EmptyTableState({
  onCreateRecord,
  onImportData,
}: EmptyTableStateProps) {
  return (
    <EmptyState
      icon={<Database className="h-12 w-12" />}
      title="No records yet"
      description="Get started by adding your first record or importing data from a CSV file."
      action={onCreateRecord ? {
        label: "Create record",
        onClick: onCreateRecord,
      } : undefined}
      secondaryAction={onImportData ? {
        label: "Import CSV",
        onClick: onImportData,
      } : undefined}
    />
  )
}

