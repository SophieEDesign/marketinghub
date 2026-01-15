"use client"

/**
 * PageViewBlockWrapper - Wraps a page view as a block for unified rendering
 * 
 * This component converts a page view into a block-like structure and uses GridBlock
 * to render it, ensuring page views and blocks share the same renderer, settings
 * schema, and data logic.
 */

import { useMemo } from "react"
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
  // Convert page to block structure - use useMemo to ensure it updates when pageTableId changes
  // This is critical: when pageTableId is loaded asynchronously, the block config must update
  const block: PageBlock = useMemo(() => {
    // CRITICAL: Resolve tableId with proper fallback chain
    // Enforce: const tableId = block.config.table_id || pageTableId || page.base_table || null
    const resolvedTableId = config.table_id || pageTableId || config.base_table || page.base_table || null
    
    // Determine view_id
    const resolvedViewId = page.saved_view_id || config.view_id || undefined
    
    return {
      id: `page-${page.id}`,
      page_id: page.id,
      type: 'grid', // GridBlock handles all view types
      x: 0,
      y: 0,
      w: 12, // Full width for page views
      h: 12, // Full height for page views
      config: {
        // Pass through page config first
        ...config,
        // Then override with our resolved values to ensure they take precedence
        table_id: resolvedTableId || undefined, // Use undefined instead of null for consistency
        view_id: resolvedViewId,
        view_type: viewType,
      },
      order_index: 0,
      created_at: page.created_at || new Date().toISOString(),
    }
  }, [page.id, page.saved_view_id, page.base_table, page.created_at, pageTableId, viewType, config])

  return (
    <div className="h-full w-full">
      <GridBlock
        block={block}
        isEditing={false}
        pageTableId={pageTableId}
        pageId={page.id}
        filters={filters || []}
        pageShowAddRecord={(page as any)?.config?.show_add_record === true || (page as any)?.config?.showAddRecord === true}
      />
    </div>
  )
}

