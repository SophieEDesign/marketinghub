"use client"

import { useEffect, useMemo, useState, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRecordPanel } from "@/contexts/RecordPanelContext"
import type { TableField } from "@/types/fields"
import LookupFieldPicker, { type LookupFieldConfig } from "@/components/fields/LookupFieldPicker"
import { getPrimaryFieldName } from "@/lib/fields/primary"
import { toPostgrestColumn } from "@/lib/supabase/postgrest"
import RecordModal from "@/components/calendar/RecordModal"

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

  // Check if this cell has a migration error (unmatched value)
  const migrationErrors = field.options?._migration_errors as Array<{ recordId: string; value: string }> | undefined
  const cellError = useMemo(() => {
    if (!migrationErrors || value != null) return null
    // If value is null and there's a migration error for this record, show it
    return migrationErrors.find(err => err.recordId === rowId)
  }, [migrationErrors, rowId, value])

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

  const [createRecordModalOpen, setCreateRecordModalOpen] = useState(false)
  const [createRecordTableId, setCreateRecordTableId] = useState<string | null>(null)
  const [createRecordTableFields, setCreateRecordTableFields] = useState<any[]>([])
  const [createRecordResolve, setCreateRecordResolve] = useState<((id: string | null) => void) | null>(null)

  const handleCreateLinkedRecord = async (tableId: string): Promise<string | null> => {
    if (!tableId) return null
    
    return new Promise((resolve) => {
      const supabase = createClient()
      
      // Fetch table fields for the modal
      supabase
        .from("table_fields")
        .select("*")
        .eq("table_id", tableId)
        .order("position", { ascending: true })
        .then(({ data: fields, error }) => {
          if (error) {
            console.error("[LinkedRecordCell] Error loading table fields:", error)
            resolve(null)
            return
          }

          // Store the resolve function and open modal
          setCreateRecordResolve(() => resolve)
          setCreateRecordTableId(tableId)
          setCreateRecordTableFields(fields || [])
          setCreateRecordModalOpen(true)
        })
    })
  }

  // Handle modal save - called when RecordModal saves successfully
  const handleModalSave = useCallback((createdRecordId?: string | null) => {
    if (createRecordResolve) {
      createRecordResolve(createdRecordId || null)
      setCreateRecordResolve(null)
    }
    setCreateRecordModalOpen(false)
    setCreateRecordTableId(null)
    setCreateRecordTableFields([])
  }, [createRecordResolve])

  // Handle modal close - called when RecordModal is closed without saving
  const handleModalClose = useCallback(() => {
    if (createRecordResolve) {
      createRecordResolve(null)
      setCreateRecordResolve(null)
    }
    setCreateRecordModalOpen(false)
    setCreateRecordTableId(null)
    setCreateRecordTableFields([])
  }, [createRecordResolve])

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
    <>
      <div
        className={`w-full h-full px-2 flex items-center overflow-hidden ${
          cellError ? 'bg-red-50 border border-red-300 rounded' : ''
        }`}
        style={rowHeight ? { height: `${rowHeight}px` } : undefined}
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
        title={cellError ? `Unmatched value: "${cellError.value}" (could not find matching record in linked table)` : undefined}
      >
        <LookupFieldPicker
          field={field}
          value={normalizedIds as any}
          onChange={async (newValue) => {
            if (isDisabled) return
            try {
              await onSave(newValue)
            } catch (e: any) {
              console.error("[LinkedRecordCell] Error saving linked record value:", e)
              alert(e?.message || "Failed to save. Please check your permissions and try again.")
            }
          }}
          config={lookupConfig}
          disabled={isDisabled}
          placeholder={
            cellError 
              ? `⚠ Unmatched: "${cellError.value}"` 
              : isDisabled 
                ? placeholder 
                : `Add ${field.name}...`
          }
          onRecordClick={handleLinkedRecordClick}
          onCreateRecord={lookupConfig.allowCreate && !isDisabled ? handleCreateLinkedRecord : undefined}
          isLookupField={false}
          compact={true}
        />
      </div>
      
      {/* Record creation modal */}
      {createRecordTableId && (
        <RecordModal
          open={createRecordModalOpen}
          onClose={handleModalClose}
          tableId={createRecordTableId}
          recordId={null}
          tableFields={createRecordTableFields}
          onSave={handleModalSave}
        />
      )}
    </>
  )
}

