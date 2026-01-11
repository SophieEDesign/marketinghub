"use client"

import type { PageBlock } from "@/lib/interface/types"
import GridBlock from "./GridBlock"
import type { FilterConfig } from "@/lib/interface/filters"

interface ListBlockProps {
  block: PageBlock
  isEditing?: boolean
  pageTableId?: string | null
  pageId?: string | null
  filters?: FilterConfig[]
  onRecordClick?: (recordId: string) => void
}

/**
 * ListBlock - Wrapper around GridBlock with view_type='grid'
 * Displays data in a simple list/table view
 */
export default function ListBlock({ block, isEditing = false, pageTableId = null, pageId = null, filters = [], onRecordClick }: ListBlockProps) {
  // Create a modified block config with view_type='grid' (list is just a grid view)
  const listBlock: PageBlock = {
    ...block,
    config: {
      ...block.config,
      view_type: 'grid',
    },
  }

  return (
    <GridBlock
      block={listBlock}
      isEditing={isEditing}
      pageTableId={pageTableId}
      pageId={pageId}
      filters={filters}
      onRecordClick={onRecordClick}
    />
  )
}
