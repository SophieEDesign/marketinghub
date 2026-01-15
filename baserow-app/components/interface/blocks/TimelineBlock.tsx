"use client"

import type { PageBlock } from "@/lib/interface/types"
import GridBlock from "./GridBlock"
import type { FilterConfig } from "@/lib/interface/filters"

interface TimelineBlockProps {
  block: PageBlock
  isEditing?: boolean
  pageTableId?: string | null
  pageId?: string | null
  filters?: FilterConfig[]
  onRecordClick?: (recordId: string) => void
  pageShowAddRecord?: boolean
}

/**
 * TimelineBlock - Wrapper around GridBlock with view_type='timeline'
 * Displays data in a timeline view
 */
export default function TimelineBlock({
  block,
  isEditing = false,
  pageTableId = null,
  pageId = null,
  filters = [],
  onRecordClick,
  pageShowAddRecord = false,
}: TimelineBlockProps) {
  // Create a modified block config with view_type='timeline'
  const timelineBlock: PageBlock = {
    ...block,
    config: {
      ...block.config,
      view_type: 'timeline',
    },
  }

  return (
    <GridBlock
      block={timelineBlock}
      isEditing={isEditing}
      pageTableId={pageTableId}
      pageId={pageId}
      filters={filters}
      onRecordClick={onRecordClick}
      pageShowAddRecord={pageShowAddRecord}
    />
  )
}
