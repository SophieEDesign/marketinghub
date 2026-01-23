"use client"

import { memo } from "react"
import FieldBuilderPanel from "@/components/layout/FieldBuilderPanel"

interface FieldsTabProps {
  tableId: string
  supabaseTableName: string
  onFieldsUpdated: () => void
}

const FieldsTab = memo(function FieldsTab({
  tableId,
  supabaseTableName,
  onFieldsUpdated,
}: FieldsTabProps) {
  return (
    <FieldBuilderPanel
      tableId={tableId}
      supabaseTableName={supabaseTableName}
      onFieldsUpdated={onFieldsUpdated}
    />
  )
})

export default FieldsTab
