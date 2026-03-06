"use client"

/**
 * RecordModalContext — Edit: RecordPanel | Create: RecordModal
 *
 * - Edit mode (recordId set): delegates to RecordPanel (right-side panel).
 * - Create mode (recordId null): renders RecordModal (e.g. day-cell click, Add record).
 */

import React, { createContext, useContext, useCallback, useState, ReactNode } from "react"
import { useRecordPanel } from "@/contexts/RecordPanelContext"
import RecordModal from "@/components/calendar/RecordModal"
import type { TableField } from "@/types/fields"
import type { BlockConfig } from "@/lib/interface/types"
import type { RecordEditorCascadeContext } from "@/lib/interface/record-editor-core"
import type { FieldLayoutItem } from "@/lib/interface/field-layout-utils"

/** State for opening record (RecordPanel for edit, RecordModal for create). */
export interface RecordModalOpenState {
  tableId: string
  recordId: string | null
  tableFields?: TableField[]
  modalFields?: string[]
  initialData?: Record<string, any>
  supabaseTableName?: string | null
  modalLayout?: BlockConfig["modal_layout"]
  fieldLayout?: FieldLayoutItem[]
  showFieldSections?: boolean
  cascadeContext?: RecordEditorCascadeContext | null
  canEditLayout?: boolean
  onLayoutSave?: (fieldLayout: FieldLayoutItem[]) => void
  initialEditMode?: boolean
  interfaceMode?: "view" | "edit"
  onSave?: (createdRecordId?: string | null) => void
  onDeleted?: () => void | Promise<void>
  keySuffix?: string
  forceFlatLayout?: boolean
}

interface RecordModalContextType {
  openRecordModal: (state: RecordModalOpenState) => void
  closeRecordModal: () => void
  isRecordModalOpen: boolean
}

const RecordModalContext = createContext<RecordModalContextType | undefined>(undefined)

export function RecordModalProvider({ children }: { children: ReactNode }) {
  const { openRecord, closeRecord } = useRecordPanel()
  const [createState, setCreateState] = useState<RecordModalOpenState | null>(null)

  const openRecordModal = useCallback(
    (openState: RecordModalOpenState) => {
      const tableName = openState.supabaseTableName ?? openState.tableId
      if (openState.recordId) {
        openRecord(
          openState.tableId,
          openState.recordId,
          tableName,
          openState.modalFields,
          openState.modalLayout,
          openState.cascadeContext,
          openState.interfaceMode,
          openState.onDeleted,
          openState.fieldLayout,
          openState.onLayoutSave ?? undefined,
          openState.tableFields
        )
      } else {
        setCreateState(openState)
      }
    },
    [openRecord]
  )

  const closeRecordModal = useCallback(() => {
    setCreateState(null)
    closeRecord()
  }, [closeRecord])

  const value: RecordModalContextType = {
    openRecordModal,
    closeRecordModal,
    isRecordModalOpen: createState !== null,
  }

  return (
    <RecordModalContext.Provider value={value}>
      {children}
      {createState && (
        <RecordModal
          open={true}
          onClose={() => setCreateState(null)}
          tableId={createState.tableId}
          recordId={null}
          tableFields={createState.tableFields ?? []}
          modalFields={createState.modalFields}
          modalLayout={createState.modalLayout}
          initialData={createState.initialData}
          supabaseTableName={createState.supabaseTableName}
          cascadeContext={createState.cascadeContext}
          canEditLayout={createState.canEditLayout}
          onLayoutSave={createState.onLayoutSave}
          interfaceMode={createState.interfaceMode ?? "edit"}
          onSave={createState.onSave}
          onDeleted={createState.onDeleted}
          forceFlatLayout={createState.forceFlatLayout}
        />
      )}
    </RecordModalContext.Provider>
  )
}

export function useRecordModal() {
  const context = useContext(RecordModalContext)
  if (!context) {
    throw new Error("useRecordModal must be used within RecordModalProvider")
  }
  return context
}
