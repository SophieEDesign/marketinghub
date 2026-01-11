"use client"

import type { PageBlock } from "@/lib/interface/types"
import GridBlock from "./GridBlock"
import type { FilterConfig } from "@/lib/interface/filters"

interface KanbanBlockProps {
  block: PageBlock
  isEditing?: boolean
  pageTableId?: string | null
  pageId?: string | null
  filters?: FilterConfig[]
  onRecordClick?: (recordId: string) => void
}

/**
 * KanbanBlock - Wrapper around GridBlock with view_type='kanban'
 * Displays data in a kanban board view
 */
export default function KanbanBlock({ block, isEditing = false, pageTableId = null, pageId = null, filters = [], onRecordClick }: KanbanBlockProps) {
  // Create a modified block config with view_type='kanban'
  const kanbanBlock: PageBlock = {
    ...block,
    config: {
      ...block.config,
      view_type: 'kanban',
    },
  }

  return (
    <GridBlock
      block={kanbanBlock}
      isEditing={isEditing}
      pageTableId={pageTableId}
      pageId={pageId}
      filters={filters}
      onRecordClick={onRecordClick}
    />
  )
}
