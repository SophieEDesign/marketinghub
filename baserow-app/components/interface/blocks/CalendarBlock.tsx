"use client"

import type { PageBlock } from "@/lib/interface/types"
import GridBlock from "./GridBlock"
import type { FilterConfig } from "@/lib/interface/filters"
import type { FilterTree } from "@/lib/filters/canonical-model"

interface CalendarBlockProps {
  block: PageBlock
  isEditing?: boolean
  pageTableId?: string | null
  pageId?: string | null
  filters?: FilterConfig[]
  filterTree?: FilterTree
  onRecordClick?: (recordId: string, tableId?: string) => void
  pageShowAddRecord?: boolean
}

/**
 * CalendarBlock - Wrapper around GridBlock with view_type='calendar'
 * Displays data in a calendar view
 */
export default function CalendarBlock({
  block,
  isEditing = false,
  pageTableId = null,
  pageId = null,
  filters = [],
  filterTree = null,
  onRecordClick,
  pageShowAddRecord = false,
}: CalendarBlockProps) {
  // Create a modified block config with view_type='calendar'
  const calendarBlock: PageBlock = {
    ...block,
    config: {
      ...block.config,
      view_type: 'calendar',
    },
  }

  return (
    <GridBlock
      block={calendarBlock}
      isEditing={isEditing}
      pageTableId={pageTableId}
      pageId={pageId}
      filters={filters}
      filterTree={filterTree}
      onRecordClick={onRecordClick}
      pageShowAddRecord={pageShowAddRecord}
    />
  )
}
