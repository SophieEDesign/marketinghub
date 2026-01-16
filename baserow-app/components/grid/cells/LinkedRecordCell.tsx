"use client"

import { useEffect, useMemo, useState } from "react"
import { ExternalLink } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useRecordPanel } from "@/contexts/RecordPanelContext"
import type { FieldOptions } from "@/types/fields"

type LinkedValue =
  | string
  | { id: string; value?: string; label?: string; name?: string }
  | Array<string | { id: string; value?: string; label?: string; name?: string }>

interface LinkedRecordCellProps {
  value: LinkedValue | null | undefined
  fieldName: string
  fieldOptions?: FieldOptions
  placeholder?: string
}

export default function LinkedRecordCell({
  value,
  fieldName,
  fieldOptions,
  placeholder = "—",
}: LinkedRecordCellProps) {
  const { openRecord } = useRecordPanel()
  const linkedTableId = fieldOptions?.linked_table_id
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

  const pills = useMemo(() => {
    if (value == null) return []
    const arr = Array.isArray(value) ? value : [value]
    return arr
      .filter((v) => v !== null && v !== undefined && v !== "")
      .map((v) => {
        if (typeof v === "string") return { id: v, label: v }
        if (typeof v === "object" && v && "id" in v) {
          const label = v.value ?? v.label ?? v.name ?? v.id
          return { id: v.id, label }
        }
        return { id: String(v), label: String(v) }
      })
      .filter((p) => !!p.id)
  }, [value])

  const handleOpen = async (e: React.MouseEvent, recordId: string) => {
    e.preventDefault()
    e.stopPropagation()
    // Prevent row double-click open from bubbling through
    ;(e.nativeEvent as any)?.stopImmediatePropagation?.()

    if (!linkedTableId) return

    // Prefer opening in the record panel when we know the linked table name.
    if (linkedTable?.supabase_table) {
      openRecord(linkedTableId, recordId, linkedTable.supabase_table)
      return
    }

    // Fallback: navigate to the record page.
    window.location.href = `/tables/${linkedTableId}/records/${recordId}`
  }

  if (!linkedTableId || pills.length === 0) {
    return (
      <div className="w-full min-h-[36px] px-3 py-2 flex items-center text-sm text-gray-400 italic">
        {placeholder}
      </div>
    )
  }

  return (
    <div
      className="w-full min-h-[36px] px-3 py-2 flex items-center gap-1.5 flex-wrap"
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      aria-label={`${fieldName} linked records`}
    >
      {pills.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={(e) => handleOpen(e, p.id)}
          onDoubleClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors cursor-pointer border border-blue-200"
          title="Open linked record"
          aria-label={`Open linked record ${p.label}`}
        >
          <span className="truncate max-w-[180px]">{p.label}</span>
          <ExternalLink className="h-3 w-3 opacity-70 flex-shrink-0" />
        </button>
      ))}
    </div>
  )
}

