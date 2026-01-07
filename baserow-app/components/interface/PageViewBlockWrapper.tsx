"use client"

/**
 * PageViewBlockWrapper - Wraps a page view as a block for unified rendering
 * 
 * This component converts a page view into a block-like structure and uses GridBlock
 * to render it, ensuring page views and blocks share the same renderer, settings
 * schema, and data logic.
 */

import GridBlock from "./blocks/GridBlock"
import type { PageBlock, ViewType } from "@/lib/interface/types"
import type { InterfacePage } from "@/lib/interface/page-types-only"

interface PageViewBlockWrapperProps {
  page: InterfacePage
  pageTableId: string | null
  viewType: ViewType
  config?: Record<string, any>
  filters?: any[]
}

export default function PageViewBlockWrapper({
  page,
  pageTableId,
  viewType,
  config = {},
  filters = [],
}: PageViewBlockWrapperProps) {
  // Convert page to block structure
  const block: PageBlock = {
    id: `page-${page.id}`,
    page_id: page.id,
    type: 'grid', // GridBlock handles all view types
    x: 0,
    y: 0,
    w: 12, // Full width for page views
    h: 12, // Full height for page views
    config: {
      table_id: pageTableId || config.table_id || config.base_table || undefined,
      view_id: page.saved_view_id || config.view_id || undefined,
      view_type: viewType,
      // Pass through page config
      ...config,
    },
    order_index: 0,
    created_at: page.created_at || new Date().toISOString(),
  }

  return (
    <div className="h-full w-full">
      <GridBlock
        block={block}
        isEditing={false}
        pageTableId={pageTableId}
        pageId={page.id}
        filters={filters || []}
      />
    </div>
  )
}

