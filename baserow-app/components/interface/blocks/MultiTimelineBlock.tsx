"use client"

import type { PageBlock } from "@/lib/interface/types"
import type { FilterConfig } from "@/lib/interface/filters"
import MultiTimelineView from "@/components/views/MultiTimelineView"

interface MultiTimelineBlockProps {
  block: PageBlock
  isEditing?: boolean
  pageId?: string | null
  filters?: FilterConfig[]
  onRecordClick?: (recordId: string, tableId?: string) => void
  pageShowAddRecord?: boolean
}

/**
 * MultiTimelineBlock
 * Distinct block type from Timeline.
 * Renders a unified timeline composed from multiple source tables at the view layer.
 */
export default function MultiTimelineBlock({
  block,
  isEditing = false,
  pageId = null,
  filters = [],
  onRecordClick,
  pageShowAddRecord = false,
}: MultiTimelineBlockProps) {
  const rawSources = Array.isArray((block.config as any)?.sources)
    ? ((block.config as any).sources as any[])
    : []

  // Backward compatibility: normalize legacy/camelCase keys for older saved configs.
  const sources = rawSources.map((s: any, idx: number) => ({
    ...s,
    id: s?.id ?? s?.source_id ?? s?.sourceId ?? `source_${idx + 1}`,
    table_id: s?.table_id ?? s?.tableId ?? s?.table ?? "",
    view_id: s?.view_id ?? s?.viewId,
    title_field: s?.title_field ?? s?.titleField ?? s?.title ?? "",
    start_date_field: s?.start_date_field ?? s?.startDateField ?? s?.start_date ?? "",
    end_date_field: s?.end_date_field ?? s?.endDateField ?? s?.end_date,
    color_field: s?.color_field ?? s?.colorField,
    type_field: s?.type_field ?? s?.typeField,
  }))

  if (sources.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 text-sm p-4">
        <div className="text-center space-y-2">
          <p>{isEditing ? "Configure sources for this Multi Timeline block." : "No sources configured"}</p>
          {isEditing && (
            <p className="text-xs text-gray-400">Open block settings and add at least one source table.</p>
          )}
        </div>
      </div>
    )
  }

  return (
    <MultiTimelineView
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

