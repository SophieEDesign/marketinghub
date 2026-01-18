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
  rowHeight?: number
  onSave: (value: any) => Promise<void>
  placeholder?: string
  contextReadOnly?: boolean
}

export default function LinkedRecordCell({
  field,
  value,
  rowId,
  editable = true,
  rowHeight,
  onSave,
  placeholder = "—",
  contextReadOnly,
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

  const relationshipType = field.options?.relationship_type || "one-to-many"
  const isMulti =
    relationshipType === "one-to-many" ||
    relationshipType === "many-to-many" ||
    (typeof field.options?.max_selections === "number" && field.options.max_selections > 1)

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
    // Keep an array for multi relationships, otherwise a single id.
    return isMulti ? ids : ids[0]
  }, [isMulti, value])

  const isMirrored = !!field.options?.read_only
  const isDisabled = !editable || isMirrored

  const lookupConfig: LookupFieldConfig | undefined = linkedTableId
    ? {
        lookupTableId: linkedTableId,
        relationshipType,
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
      openRecord(tableId, recordId, linkedTable.supabase_table, undefined, contextReadOnly)
      return
    }

    // Fallback: navigate to the record page.
    window.location.href = `/tables/${tableId}/records/${recordId}`
  }

  const rowHeightStyle = rowHeight
    ? {
        height: `${rowHeight}px`,
        minHeight: `${rowHeight}px`,
        maxHeight: `${rowHeight}px`,
      }
    : { minHeight: '36px' }

  if (!linkedTableId || !lookupConfig) {
    return (
      <div className="w-full h-full px-3 py-2 flex items-center text-sm text-gray-400 italic box-border" style={rowHeightStyle}>
        {placeholder}
      </div>
    )
  }

  return (
    <div className="w-full h-full px-2 py-1.5 box-border overflow-hidden" style={rowHeightStyle} onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
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

