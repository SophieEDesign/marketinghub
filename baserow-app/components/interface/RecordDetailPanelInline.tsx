"use client"

/**
 * Record Detail Panel Inline (Right Panel)
 *
 * Airtable-style inline record detail panel for Record View pages.
 * Uses unified RecordEditor with mode="review" and visibilityContext="canvas".
 * Single source of truth: field_layout drives everything.
 */

import RecordEditor from "@/components/records/RecordEditor"
import { useRecordModal } from "@/contexts/RecordModalContext"
import type { TableField } from "@/types/fields"
import type { FieldLayoutItem } from "@/lib/interface/field-layout-utils"
import type { RecordEditorCascadeContext } from "@/lib/interface/record-editor-core"

interface RecordDetailPanelInlineProps {
  pageId: string
  tableId: string | null
  recordId: string | null
  tableName: string | null
  fields: TableField[]
  fieldLayout: FieldLayoutItem[]
  pageEditable?: boolean
  interfaceMode?: "view" | "edit"
  onLayoutSave?: (fieldLayout: FieldLayoutItem[]) => Promise<void>
  titleField?: string
}

export default function RecordDetailPanelInline({
  pageId,
  tableId,
  recordId,
  tableName,
  fields,
  fieldLayout,
  pageEditable = true,
  interfaceMode = "view",
  onLayoutSave,
}: RecordDetailPanelInlineProps) {
  const { openRecordModal } = useRecordModal()

  if (!tableId) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 p-8">
        <p className="text-sm">No table selected. Configure the page in Settings.</p>
      </div>
    )
  }

  if (!recordId) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 p-8">
        <p className="text-sm">Select a record from the list</p>
        <p className="text-xs text-gray-400 mt-1">Click a record to view its details</p>
      </div>
    )
  }

  const cascadeContext: RecordEditorCascadeContext = { pageConfig: {} }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <RecordEditor
        recordId={recordId}
        tableId={tableId}
        mode="review"
        fieldLayoutConfig={fieldLayout}
        tableFields={fields}
        supabaseTableName={tableName}
        cascadeContext={cascadeContext}
        active={true}
        allowEdit={pageEditable}
        visibilityContext="canvas"
        canEditLayout={pageEditable && Boolean(onLayoutSave)}
        onLayoutSave={onLayoutSave}
        onOpenModal={() =>
          openRecordModal({
            tableId,
            recordId,
            supabaseTableName: tableName ?? undefined,
            fieldLayout,
            tableFields: fields,
            cascadeContext,
            interfaceMode,
          })
        }
        showComments={true}
        interfaceMode={interfaceMode}
        renderHeaderActions={false}
      />
    </div>
  )
}
