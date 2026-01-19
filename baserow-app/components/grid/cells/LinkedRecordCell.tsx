"use client"

import { useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRecordPanel } from "@/contexts/RecordPanelContext"
import type { TableField } from "@/types/fields"
import LookupFieldPicker, { type LookupFieldConfig } from "@/components/fields/LookupFieldPicker"
import { getPrimaryFieldName } from "@/lib/fields/primary"
import { toPostgrestColumn } from "@/lib/supabase/postgrest"

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
}

export default function LinkedRecordCell({
  field,
  value,
  rowId,
  editable = true,
  rowHeight,
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
      openRecord(tableId, recordId, linkedTable.supabase_table)
      return
    }

    // Fallback: navigate to the record page.
    window.location.href = `/tables/${tableId}/records/${recordId}`
  }

  const handleCreateLinkedRecord = async (tableId: string): Promise<string | null> => {
    if (!tableId) return null
    try {
      const supabase = createClient()

      // Load table metadata to find the physical table name.
      const { data: table, error: tableError } = await supabase
        .from("tables")
        .select("supabase_table, primary_field_name")
        .eq("id", tableId)
        .maybeSingle()

      if (tableError || !table?.supabase_table) {
        console.error("[LinkedRecordCell] Failed to load linked table metadata:", tableError)
        return null
      }

      // Best-effort: try to prefill a primary text-like field so the record isn't "blank".
      // If we can't safely determine a physical column name, fall back to inserting an empty row.
      const payload: Record<string, any> = {}
      const { data: linkedFields } = await supabase
        .from("table_fields")
        .select("name, type, position, order_index, options")
        .eq("table_id", tableId)
        .order("position", { ascending: true })

      const configuredPrimary =
        typeof (table as any)?.primary_field_name === "string" &&
        String((table as any).primary_field_name).trim().length > 0 &&
        String((table as any).primary_field_name).trim() !== "id"
          ? String((table as any).primary_field_name).trim()
          : null

      const candidatePrimaryName = configuredPrimary || getPrimaryFieldName(linkedFields as any)
      if (candidatePrimaryName) {
        const safePrimaryCol = toPostgrestColumn(candidatePrimaryName)
        const primaryField = Array.isArray(linkedFields)
          ? linkedFields.find((f: any) => f?.name === candidatePrimaryName)
          : null

        const isTextLike =
          primaryField && ["text", "long_text", "email", "url"].includes(String(primaryField.type))

        if (safePrimaryCol && safePrimaryCol !== "id" && isTextLike) {
          payload[safePrimaryCol] = "New record"
        }
      }

      // Try insert with payload first, then fall back to empty row if needed.
      const attemptInsert = async (data: Record<string, any>) => {
        return await supabase.from(table.supabase_table).insert([data]).select().single()
      }

      let inserted = await attemptInsert(payload)
      if (inserted.error && Object.keys(payload).length > 0) {
        inserted = await attemptInsert({})
      }

      if (inserted.error) {
        console.error("[LinkedRecordCell] Failed to create linked record:", inserted.error)
        alert("Failed to create linked record. Please check required fields and permissions.")
        return null
      }

      const createdId = (inserted.data as any)?.id || (inserted.data as any)?.record_id
      return createdId ? String(createdId) : null
    } catch (e) {
      console.error("[LinkedRecordCell] Failed to create linked record:", e)
      alert("Failed to create linked record. Please try again.")
      return null
    }
  }

  if (!linkedTableId || !lookupConfig) {
    return (
      <div
        className="w-full h-full px-3 flex items-center text-sm text-gray-400 italic overflow-hidden"
        style={rowHeight ? { height: `${rowHeight}px` } : undefined}
      >
        {placeholder}
      </div>
    )
  }

  return (
    <div
      className="w-full h-full px-2 flex items-center overflow-hidden"
      style={rowHeight ? { height: `${rowHeight}px` } : undefined}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
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
        onCreateRecord={lookupConfig.allowCreate && !isDisabled ? handleCreateLinkedRecord : undefined}
        isLookupField={false}
        compact={true}
      />
    </div>
  )
}

