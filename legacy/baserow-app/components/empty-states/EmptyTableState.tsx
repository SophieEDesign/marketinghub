"use client"

import EmptyState from "./EmptyState"
import { EmptyTableIllustration } from "./EmptyStateIllustrations"

interface EmptyTableStateProps {
  onCreateRecord?: () => void
  onImportData?: () => void
  onConfigureView?: () => void
}

export default function EmptyTableState({
  onCreateRecord,
  onImportData,
  onConfigureView,
}: EmptyTableStateProps) {
  return (
    <EmptyState
      illustration={<EmptyTableIllustration className="w-28 h-20" />}
      title="No records yet"
      description="Get started by adding your first record or importing data from a CSV file."
      action={onCreateRecord ? {
        label: "Create record",
        onClick: onCreateRecord,
      } : undefined}
      secondaryAction={onImportData ? {
        label: "Import CSV",
        onClick: onImportData,
      } : onConfigureView ? {
        label: "Configure view",
        onClick: onConfigureView,
      } : undefined}
    />
  )
}

