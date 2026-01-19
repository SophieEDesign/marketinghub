"use client"

import { useMemo } from "react"
import type { PageBlock } from "@/lib/interface/types"
import type { FilterConfig } from "@/lib/interface/filters"
import MultiCalendarView from "@/components/views/MultiCalendarView"

interface MultiCalendarBlockProps {
  block: PageBlock
  isEditing?: boolean
  pageId?: string | null
  filters?: FilterConfig[]
  onRecordClick?: (recordId: string, tableId?: string) => void
  pageShowAddRecord?: boolean
}

/**
 * MultiCalendarBlock
 * Distinct block type from Calendar.
 * Renders a unified calendar composed from multiple source tables at the view layer.
 */
export default function MultiCalendarBlock({
  block,
  isEditing = false,
  pageId = null,
  filters = [],
  onRecordClick,
  pageShowAddRecord = false,
}: MultiCalendarBlockProps) {
  const rawSources = Array.isArray((block.config as any)?.sources)
    ? ((block.config as any).sources as any[])
    : []

  function buildRawSourcesKey(list: any[]) {
    // Avoid JSON.stringify here: configs can contain non-JSON values (e.g. BigInt),
    // which would throw and trigger the block ErrorBoundary.
    return (Array.isArray(list) ? list : [])
      .map((s: any) => {
        const table = s?.table_id ?? s?.tableId ?? s?.table ?? ""
        const view = s?.view_id ?? s?.viewId ?? ""
        const title = s?.title_field ?? s?.titleField ?? s?.title ?? ""
        const start = s?.start_date_field ?? s?.startDateField ?? s?.start_date ?? ""
        const end = s?.end_date_field ?? s?.endDateField ?? s?.end_date ?? ""
        const color = s?.color_field ?? s?.colorField ?? ""
        const type = s?.type_field ?? s?.typeField ?? ""
        const enabled = s?.enabled === false ? "0" : "1"
        return [s?.id ?? "", enabled, table, view, title, start, end, color, type].map((x) => String(x ?? "")).join("~")
      })
      .join("|")
  }

  // Backward compatibility: normalize legacy/camelCase keys for older saved configs.
  // IMPORTANT: keep `sources` reference stable when config content doesn't change.
  // FullCalendar can enter internal update loops when it receives new option/prop
  // object identities every render.
  const rawSourcesKey = useMemo(() => buildRawSourcesKey(rawSources), [rawSources])

  const sources = useMemo(() => {
    return (rawSources || []).map((s: any) => ({
      ...s,
      table_id: s?.table_id ?? s?.tableId ?? s?.table ?? "",
      view_id: s?.view_id ?? s?.viewId,
      title_field: s?.title_field ?? s?.titleField ?? s?.title ?? "",
      start_date_field: s?.start_date_field ?? s?.startDateField ?? s?.start_date ?? "",
      end_date_field: s?.end_date_field ?? s?.endDateField ?? s?.end_date,
      color_field: s?.color_field ?? s?.colorField,
      type_field: s?.type_field ?? s?.typeField,
    }))
  }, [rawSourcesKey])

  if (sources.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 text-sm p-4">
        <div className="text-center space-y-2">
          <p>{isEditing ? "Configure sources for this Multi Calendar block." : "No sources configured"}</p>
          {isEditing && (
            <p className="text-xs text-gray-400">Open block settings and add at least one source table.</p>
          )}
        </div>
      </div>
    )
  }

  return (
    <MultiCalendarView
      blockId={block.id}
      pageId={pageId}
      sources={sources}
      filters={filters}
      blockConfig={block.config || {}}
      isEditing={isEditing}
      onRecordClick={onRecordClick}
      pageShowAddRecord={pageShowAddRecord}
    />
  )
}

