"use client"

import { useEffect, useState } from "react"
import { Maximize2, X } from "lucide-react"
import RecordEditor from "@/components/records/RecordEditor"
import { useRecordModal } from "@/contexts/RecordModalContext"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { LoadingSpinner } from "@/components/ui/LoadingSpinner"
import type { TableField } from "@/types/fields"

interface ThingsToDoRecordSidePanelProps {
  tableId: string
  recordId: string
  supabaseTableName: string
  title: string
  onClose: () => void
  onRecordUpdated?: () => void
}

/**
 * Inline record panel for Things To Do — full record fields in the block side rail
 * (replaces the read-only preview summary + separate "Open record" step).
 */
export function ThingsToDoRecordSidePanel({
  tableId,
  recordId,
  supabaseTableName,
  title,
  onClose,
  onRecordUpdated,
}: ThingsToDoRecordSidePanelProps) {
  const { openRecordModal } = useRecordModal()
  const [tableFields, setTableFields] = useState<TableField[]>([])
  const [loadingFields, setLoadingFields] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoadingFields(true)
    void (async () => {
      try {
        const { data } = await createClient()
          .from("table_fields")
          .select("*")
          .eq("table_id", tableId)
          .order("order_index", { ascending: true })
        if (!cancelled) {
          setTableFields((data as TableField[]) || [])
          setLoadingFields(false)
        }
      } catch {
        if (!cancelled) setLoadingFields(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [tableId])

  const handleOpenFullPanel = () => {
    openRecordModal({
      tableId,
      recordId,
      supabaseTableName,
      tableFields,
      onRecordUpdated,
    })
  }

  return (
    <aside className="flex w-full shrink-0 flex-col border-t border-border/40 bg-background md:w-[min(100%,480px)] md:min-w-[360px] md:max-w-[42vw] md:border-l md:border-t-0">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border/40 px-3 py-2">
        <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{title}</h3>
        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleOpenFullPanel}
            title="Open in full record panel"
            aria-label="Open in full record panel"
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onClose}
            aria-label="Close panel"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {loadingFields ? (
          <div className="flex flex-1 items-center justify-center p-8">
            <LoadingSpinner size="md" text="Loading record…" />
          </div>
        ) : (
          <RecordEditor
            recordId={recordId}
            tableId={tableId}
            mode="review"
            tableFields={tableFields}
            supabaseTableName={supabaseTableName}
            active={true}
            allowEdit={true}
            visibilityContext="canvas"
            onOpenModal={handleOpenFullPanel}
            onRecordUpdate={onRecordUpdated ? () => onRecordUpdated() : undefined}
            interfaceMode="view"
            renderHeaderActions={false}
            showComments={false}
          />
        )}
      </div>
    </aside>
  )
}
