"use client"

import type { PageBlock } from "@/lib/interface/types"
import RecordBlock from "@/components/interface/blocks/RecordBlock"

interface RecordPreviewSurfaceProps {
  tableId: string
  recordId: string
  pageId?: string | null
  isEditing?: boolean
}

/**
 * Record preview slot for full-page rail layout (e.g. record_context).
 * Renders record details from page-level context; owns scrolling.
 * v1: uses RecordBlock with a synthetic block so we get consistent field rendering and permissions.
 */
export default function RecordPreviewSurface({
  tableId,
  recordId,
  pageId = null,
  isEditing = false,
}: RecordPreviewSurfaceProps) {
  const syntheticBlock: PageBlock = {
    id: "preview-surface",
    page_id: pageId || "",
    type: "record",
    x: 0,
    y: 0,
    w: 6,
    h: 4,
    config: { table_id: tableId, record_id: recordId },
    order_index: 0,
    created_at: "",
  }

  return (
    <div className="h-full w-full min-w-0 overflow-auto">
      <RecordBlock
        block={syntheticBlock}
        isEditing={isEditing}
        pageTableId={tableId}
        pageId={pageId}
        recordId={recordId}
      />
    </div>
  )
}
