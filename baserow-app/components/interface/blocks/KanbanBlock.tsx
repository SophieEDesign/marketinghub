"use client"

import type { PageBlock } from "@/lib/interface/types"
import GridBlock from "./GridBlock"
import type { FilterConfig } from "@/lib/interface/filters"
import type { FilterTree } from "@/lib/filters/canonical-model"
import type { FieldLayoutItem } from "@/lib/interface/field-layout-utils"

interface KanbanBlockProps {
  block: PageBlock
  isEditing?: boolean
  interfaceMode?: 'view' | 'edit'
  pageTableId?: string | null
  pageId?: string | null
  filters?: FilterConfig[]
  filterTree?: FilterTree
  onRecordClick?: (recordId: string) => void
  pageShowAddRecord?: boolean
  onModalLayoutSave?: (fieldLayout: FieldLayoutItem[]) => void
  canEditLayout?: boolean
  onUpdate?: (updates: Partial<PageBlock["config"]>) => void
}

/**
 * KanbanBlock - Wrapper around GridBlock with view_type='kanban'
 * Displays data in a kanban board view
 */
export default function KanbanBlock({
  block,
  isEditing = false,
  interfaceMode = 'view',
  pageTableId = null,
  pageId = null,
  filters = [],
  filterTree = null,
  onRecordClick,
  pageShowAddRecord = false,
  onModalLayoutSave,
  canEditLayout = false,
  onUpdate,
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
      interfaceMode={interfaceMode}
      pageTableId={pageTableId}
      pageId={pageId}
      filters={filters}
      filterTree={filterTree}
      onRecordClick={onRecordClick}
      pageShowAddRecord={pageShowAddRecord}
      onModalLayoutSave={onModalLayoutSave}
      canEditLayout={canEditLayout}
      onUpdate={onUpdate}
    />
  )
}
