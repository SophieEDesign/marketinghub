"use client"

import type { PageBlock, BlockConfig } from "@/lib/interface/types"
import RecordBlock from "@/components/interface/blocks/RecordBlock"
import RecordDetailCanvas from "./RecordDetailCanvas"

interface RecordPreviewSurfaceProps {
  tableId: string
  recordId: string
  pageId?: string | null
  isEditing?: boolean
  /** When true (default), record fields in the right panel are editable. Pass from Canvas pageEditable. */
  pageEditable?: boolean
  /** Optional record_context block config: modal_fields, field_layout, record_field_layout. */
  blockConfig?: BlockConfig | null
  /** When provided with onBlockUpdate, right panel becomes a canvas editor with field blocks. */
  blockId?: string | null
  /** Callback to persist record_field_layout to block config. */
  onBlockUpdate?: (blockId: string, config: Partial<Record<string, unknown>>) => void
}

/**
 * Record preview slot for full-page rail layout (e.g. record_context).
 * Renders record details from page-level context; owns scrolling.
 * When blockId and onBlockUpdate are provided: canvas editor with field blocks (drag/resize).
 * Otherwise: flat RecordBlock list.
 */
export default function RecordPreviewSurface({
  tableId,
  recordId,
  pageId = null,
  isEditing = false,
  pageEditable = true,
  blockConfig,
  blockId,
  onBlockUpdate,
}: RecordPreviewSurfaceProps) {
  const useCanvasEditor = Boolean(blockId && onBlockUpdate)
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/7e9b68cb-9457-4ad2-a6ab-af4806759e7a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RecordPreviewSurface.tsx',message:'Record preview path',data:{useCanvasEditor,hasBlockId:!!blockId,hasOnBlockUpdate:!!onBlockUpdate,isEditing},timestamp:Date.now(),hypothesisId:'C'})}).catch(()=>{});
  // #endregion

  if (useCanvasEditor) {
    return (
      <div className="h-full w-full min-w-0 overflow-hidden">
        <RecordDetailCanvas
          tableId={tableId}
          recordId={recordId}
          blockConfig={blockConfig as Record<string, unknown> | null}
          blockId={blockId!}
          isEditing={isEditing}
          pageEditable={pageEditable}
          onBlockUpdate={onBlockUpdate}
        />
      </div>
    )
  }

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
      ...(blockConfig?.field_layout != null && { field_layout: blockConfig.field_layout }),
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
        pageId={pageId}
        recordId={recordId}
        allowRecordEdit={pageEditable !== false}
      />
    </div>
  )
}
