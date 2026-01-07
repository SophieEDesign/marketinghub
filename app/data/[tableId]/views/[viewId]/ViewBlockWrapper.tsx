"use client"

/**
 * ViewBlockWrapper - Wraps a view as a block for unified rendering
 * 
 * This component converts a view into a block-like structure and uses GridBlock
 * to render it, ensuring page views and blocks share the same renderer, settings
 * schema, and data logic.
 */

import GridBlock from '../../../../baserow-app/components/interface/blocks/GridBlock'
import type { PageBlock, ViewType } from '../../../../baserow-app/lib/interface/types'

interface ViewBlockWrapperProps {
  tableId: string
  viewId: string
  viewType: ViewType
  viewConfig?: Record<string, any>
}

export default function ViewBlockWrapper({
  tableId,
  viewId,
  viewType,
  viewConfig = {},
}: ViewBlockWrapperProps) {
  // Convert view to block structure
  const block: PageBlock = {
    id: `view-${viewId}`,
    page_id: viewId,
    type: 'grid', // GridBlock handles all view types
    x: 0,
    y: 0,
    w: 12, // Full width for page views
    h: 12, // Full height for page views
    config: {
      table_id: tableId,
      view_id: viewId,
      view_type: viewType,
      // Pass through view config
      ...viewConfig,
    },
    order_index: 0,
    created_at: new Date().toISOString(),
  }

  return (
    <div className="h-full w-full">
      <GridBlock
        block={block}
        isEditing={false}
        pageTableId={tableId}
        pageId={viewId}
        filters={[]}
      />
    </div>
  )
}

