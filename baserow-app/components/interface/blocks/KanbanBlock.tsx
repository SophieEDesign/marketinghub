"use client"

import type { PageBlock } from "@/lib/interface/types"
import GridBlock from "./GridBlock"
import type { FilterConfig } from "@/lib/interface/filters"
import type { FilterTree } from "@/lib/filters/canonical-model"

interface KanbanBlockProps {
  block: PageBlock
  isEditing?: boolean
  pageTableId?: string | null
  pageId?: string | null
  filters?: FilterConfig[]
  filterTree?: FilterTree
  onRecordClick?: (recordId: string) => void
  pageShowAddRecord?: boolean
}

/**
 * KanbanBlock - Wrapper around GridBlock with view_type='kanban'
 * Displays data in a kanban board view
 */
export default function KanbanBlock({
  block,
  isEditing = false,
  pageTableId = null,
  pageId = null,
  filters = [],
  filterTree = null,
  onRecordClick,
  pageShowAddRecord = false,
}: KanbanBlockProps) {
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
      filterTree={filterTree}
      onRecordClick={onRecordClick}
      pageShowAddRecord={pageShowAddRecord}
    />
  )
}
