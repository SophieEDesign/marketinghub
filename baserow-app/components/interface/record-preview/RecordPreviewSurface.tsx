"use client"

import type { PageBlock, BlockConfig } from "@/lib/interface/types"
import RecordBlock from "@/components/interface/blocks/RecordBlock"

interface RecordPreviewSurfaceProps {
  tableId: string
  recordId: string
  pageId?: string | null
  isEditing?: boolean
  /** When true (default), record fields in the right panel are editable. Pass from Canvas pageEditable. */
  pageEditable?: boolean
  /** Optional record_context block config: modal_fields, modal_layout for field list and layout. */
  blockConfig?: BlockConfig | null
}

/**
 * Record preview slot for full-page rail layout (e.g. record_context).
 * Renders record details from page-level context; owns scrolling.
 * Uses RecordBlock with a synthetic block; respects block modal_fields/modal_layout and page editability.
 */
export default function RecordPreviewSurface({
  tableId,
  recordId,
  pageId = null,
  isEditing = false,
  pageEditable = true,
  blockConfig,
}: RecordPreviewSurfaceProps) {
  const syntheticBlock: PageBlock = {
    id: "preview-surface",
    page_id: pageId || "",
    type: "record",
    x: 0,
    y: 0,
    w: 6,
    h: 4,
    config: {
      table_id: tableId,
      record_id: recordId,
      ...(blockConfig?.modal_fields != null && { modal_fields: blockConfig.modal_fields }),
      ...(blockConfig?.modal_layout != null && { modal_layout: blockConfig.modal_layout }),
    },
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
        allowRecordEdit={pageEditable !== false}
      />
    </div>
  )
}
