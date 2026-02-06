"use client"

import { useEffect, useState, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import type { PageBlock } from "@/lib/interface/types"
import type { RecordContext } from "@/lib/interface/types"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function isUuidLike(value: string | null | undefined): value is string {
  return typeof value === "string" && UUID_RE.test(value)
}

interface RecordContextBlockProps {
  block: PageBlock
  isEditing?: boolean
  pageTableId?: string | null
  recordId?: string | null
  recordTableId?: string | null
  onRecordContextChange?: (context: RecordContext) => void
}

export default function RecordContextBlock({
  block,
  isEditing = false,
  pageTableId = null,
  recordId = null,
  recordTableId = null,
  onRecordContextChange,
}: RecordContextBlockProps) {
  const config = block.config || {}
  const tableId = config.table_id ?? (config as any).tableId ?? pageTableId ?? null
  const displayMode = config.displayMode ?? (config as any).display_mode ?? "list"
  const allowClear = config.allowClear ?? (config as any).allow_clear ?? true

  const [table, setTable] = useState<{ id: string; supabase_table: string; name?: string | null } | null>(null)
  const [records, setRecords] = useState<{ id: string; [k: string]: unknown }[]>([])
  const [loading, setLoading] = useState(true)
  const [titleField, setTitleField] = useState<string | null>(null)

  useEffect(() => {
    if (!tableId) {
      setLoading(false)
      setTable(null)
      setRecords([])
      setTitleField(null)
      return
    }

    let cancelled = false

    async function load() {
      const supabase = createClient()
      let resolved: { id: string; supabase_table: string; name?: string | null } | null = null

      if (isUuidLike(tableId)) {
        const { data } = await supabase
          .from("tables")
          .select("id, supabase_table, name")
          .eq("id", tableId)
          .maybeSingle()
        if (data) resolved = data as any
      } else {
        const { data: byName } = await supabase
          .from("tables")
          .select("id, supabase_table, name")
          .eq("name", tableId)
          .maybeSingle()
        if (byName) {
          resolved = byName as any
        } else {
          const { data: bySupabase } = await supabase
            .from("tables")
            .select("id, supabase_table, name")
            .eq("supabase_table", tableId)
            .maybeSingle()
          if (bySupabase) resolved = bySupabase as any
        }
      }

      if (cancelled || !resolved?.id) {
        if (!cancelled) {
          setTable(null)
          setRecords([])
          setTitleField(null)
        }
        return
      }

      setTable(resolved)

      const { data: fields } = await supabase
        .from("table_fields")
        .select("id, name, type")
        .eq("table_id", resolved.id)
        .order("position", { ascending: true })

      const fieldList = (fields || []) as { id: string; name: string; type: string }[]
      const firstText = fieldList.find((f) => f.type === "text" || f.type === "long_text" || f.type === "single_line_text")
      const titleKey = firstText?.name ?? "id"
      setTitleField(titleKey)

      const selectCols = ["id", titleKey].filter((c) => c === "id" || fieldList.some((f) => f.name === c))
      const { data: rows } = await supabase
        .from(resolved.supabase_table)
        .select(selectCols.join(", "))
        .limit(200)
        .order("id", { ascending: false })

      if (!cancelled) {
        setRecords((rows as { id: string; [k: string]: unknown }[]) || [])
      }
    }

    setLoading(true)
    load().finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [tableId])

  const handleSelect = (record: { id: string }) => {
    if (!table || !onRecordContextChange) return
    onRecordContextChange({ tableId: table.id, recordId: record.id })
  }

  const handleClear = () => {
    if (!onRecordContextChange) return
    onRecordContextChange(null)
  }

  const selectedInThisBlock = table && recordTableId === table.id && recordId

  if (!tableId) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground text-sm p-4 rounded-md border border-dashed">
        {isEditing ? "Configure a table in block settings." : "No table selected."}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground text-sm p-4">
        Loading…
      </div>
    )
  }

  if (!table) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground text-sm p-4 rounded-md border border-dashed">
        Table not found.
      </div>
    )
  }

  const getLabel = (record: { id: string; [k: string]: unknown }) => {
    if (titleField && record[titleField] != null && String(record[titleField]).trim() !== "") {
      return String(record[titleField])
    }
    return record.id
  }

  return (
    <div className="h-full w-full flex flex-col gap-2 p-2 rounded-md border bg-card">
      {allowClear && selectedInThisBlock && (
        <div className="flex items-center justify-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="gap-1"
          >
            <X className="h-4 w-4" />
            Clear selection
          </Button>
        </div>
      )}
      <div
        className={cn(
          "flex flex-1 min-h-0 overflow-auto",
          displayMode === "grid" && "flex flex-wrap content-start gap-2",
          displayMode === "compact" && "flex flex-wrap gap-1"
        )}
      >
        {records.length === 0 ? (
          <p className="text-muted-foreground text-sm p-2">No records in this table.</p>
        ) : displayMode === "grid" ? (
          records.map((record) => {
            const isActive = selectedInThisBlock === record.id
            return (
              <button
                key={record.id}
                type="button"
                onClick={() => handleSelect(record)}
                className={cn(
                  "rounded-lg border p-3 text-left text-sm transition-colors hover:bg-accent",
                  isActive && "ring-2 ring-primary bg-accent"
                )}
              >
                {getLabel(record)}
              </button>
            )
          })
        ) : displayMode === "compact" ? (
          records.map((record) => {
            const isActive = selectedInThisBlock === record.id
            return (
              <button
                key={record.id}
                type="button"
                onClick={() => handleSelect(record)}
                className={cn(
                  "rounded-md border px-2 py-1 text-xs transition-colors hover:bg-accent",
                  isActive && "ring-2 ring-primary bg-accent"
                )}
              >
                {getLabel(record)}
              </button>
            )
          })
        ) : (
          <ul className="w-full space-y-1">
            {records.map((record) => {
              const isActive = selectedInThisBlock === record.id
              return (
                <li key={record.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(record)}
                    className={cn(
                      "w-full rounded-md border px-3 py-2 text-left text-sm transition-colors hover:bg-accent",
                      isActive && "ring-2 ring-primary bg-accent"
                    )}
                  >
                    {getLabel(record)}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
