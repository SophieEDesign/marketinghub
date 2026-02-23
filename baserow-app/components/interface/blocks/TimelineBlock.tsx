"use client"

import type { PageBlock } from "@/lib/interface/types"
import GridBlock from "./GridBlock"
import type { FilterConfig } from "@/lib/interface/filters"
import type { FilterTree } from "@/lib/filters/canonical-model"
import type { FieldLayoutItem } from "@/lib/interface/field-layout-utils"

interface TimelineBlockProps {
  block: PageBlock
  isEditing?: boolean
  interfaceMode?: 'view' | 'edit'
  pageTableId?: string | null
  pageId?: string | null
  filters?: FilterConfig[]
  filterTree?: FilterTree
  onRecordClick?: (recordId: string, tableId?: string) => void
  pageShowAddRecord?: boolean
  onModalLayoutSave?: (fieldLayout: FieldLayoutItem[]) => void
  canEditLayout?: boolean
}

/**
 * TimelineBlock - Wrapper around GridBlock with view_type='timeline'
 * Displays data in a timeline view
 */
export default function TimelineBlock({
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
      interfaceMode={interfaceMode}
      pageTableId={pageTableId}
      pageId={pageId}
      filters={filters}
      filterTree={filterTree}
      onRecordClick={onRecordClick}
      pageShowAddRecord={pageShowAddRecord}
      onModalLayoutSave={onModalLayoutSave}
      canEditLayout={canEditLayout}
    />
  )
}
