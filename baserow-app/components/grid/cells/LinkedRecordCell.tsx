"use client"

import { useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRecordPanel } from "@/contexts/RecordPanelContext"
import type { TableField } from "@/types/fields"
import LookupFieldPicker, { type LookupFieldConfig } from "@/components/fields/LookupFieldPicker"

type LinkedValue =
  | string
  | { id: string; value?: string; label?: string; name?: string }
  | Array<string | { id: string; value?: string; label?: string; name?: string }>

interface LinkedRecordCellProps {
  field: TableField
  value: LinkedValue | null | undefined
  rowId: string
  editable?: boolean
  onSave: (value: any) => Promise<void>
  placeholder?: string
}

export default function LinkedRecordCell({
  field,
  value,
  rowId,
  editable = true,
  onSave,
  placeholder = "—",
}: LinkedRecordCellProps) {
  const { openRecord } = useRecordPanel()
  const linkedTableId = field.options?.linked_table_id
  const [linkedTable, setLinkedTable] = useState<{ id: string; supabase_table: string } | null>(null)

  useEffect(() => {
    if (!linkedTableId) {
      setLinkedTable(null)
      return
    }

    let cancelled = false
    const load = async () => {
      try {
        const supabase = createClient()
        const { data } = await supabase
          .from("tables")
          .select("id, supabase_table")
          .eq("id", linkedTableId)
          .maybeSingle()
        if (!cancelled) {
          setLinkedTable(data ?? null)
        }
      } catch {
        if (!cancelled) setLinkedTable(null)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [linkedTableId])

  const normalizedIds = useMemo(() => {
    if (value == null) return null
    const arr = Array.isArray(value) ? value : [value]
    const ids = arr
      .filter((v) => v !== null && v !== undefined && v !== "")
      .map((v) => {
        if (typeof v === "string") return v
        if (typeof v === "object" && v && "id" in v) return v.id
        return String(v)
      })
      .filter(Boolean)
    if (ids.length === 0) return null
    // If the underlying value is an array, keep an array; otherwise keep a single id.
    return Array.isArray(value) ? ids : ids[0]
  }, [value])

  const isMirrored = !!field.options?.read_only
  const isDisabled = !editable || isMirrored

  const lookupConfig: LookupFieldConfig | undefined = linkedTableId
    ? {
        lookupTableId: linkedTableId,
        primaryLabelField: field.options?.primary_label_field || "name",
        secondaryLabelFields: field.options?.secondary_label_fields || [],
        relationshipType: field.options?.relationship_type || "one-to-many",
        maxSelections: field.options?.max_selections,
        required: field.required,
        allowCreate: field.options?.allow_create,
      }
    : undefined

  const handleLinkedRecordClick = async (tableId: string, recordId: string) => {
    // Never open the current record (self-link edge case)
    if (tableId === field.table_id && recordId === rowId) return
    if (!linkedTableId) return

    // Prefer opening in the record panel when we know the linked table name.
    if (linkedTable?.supabase_table) {
      openRecord(tableId, recordId, linkedTable.supabase_table)
      return
    }

    // Fallback: navigate to the record page.
    window.location.href = `/tables/${tableId}/records/${recordId}`
  }

  if (!linkedTableId || !lookupConfig) {
    return (
      <div className="w-full min-h-[36px] px-3 py-2 flex items-center text-sm text-gray-400 italic">
        {placeholder}
      </div>
    )
  }

  return (
    <div className="w-full min-h-[36px] px-2 py-1.5" onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
      <LookupFieldPicker
        field={field}
        value={normalizedIds as any}
        onChange={async (newValue) => {
          if (isDisabled) return
          await onSave(newValue)
        }}
        config={lookupConfig}
        disabled={isDisabled}
        placeholder={isDisabled ? placeholder : `Add ${field.name}...`}
        onRecordClick={handleLinkedRecordClick}
        isLookupField={false}
      />
    </div>
  )
}

