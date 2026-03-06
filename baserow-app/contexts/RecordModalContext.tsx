"use client"

/**
 * RecordModalContext — Edit and Create both use RecordPanel
 *
 * - Edit mode (recordId set): delegates to RecordPanel (right-side panel).
 * - Create mode (recordId null): opens RecordPanel in create mode (same UI as edit).
 */

import React, { createContext, useContext, useCallback, ReactNode } from "react"
import { useRecordPanel } from "@/contexts/RecordPanelContext"
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
  /** Called when a field is updated (edit mode); use to refresh parent view. */
  onRecordUpdated?: () => void
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
  const { openRecord, openRecordForCreate, closeRecord, state: recordPanelState } = useRecordPanel()

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
          openState.onRecordUpdated,
          openState.fieldLayout,
          openState.onLayoutSave ?? undefined,
          openState.tableFields
        )
      } else {
        openRecordForCreate({
          tableId: openState.tableId,
          tableName,
          tableFields: openState.tableFields,
          modalFields: openState.modalFields,
          modalLayout: openState.modalLayout,
          initialData: openState.initialData,
          cascadeContext: openState.cascadeContext,
          onRecordCreated: (id) => openState.onSave?.(id),
        })
      }
    },
    [openRecord, openRecordForCreate]
  )

  const closeRecordModal = useCallback(() => {
    closeRecord()
  }, [closeRecord])

  const value: RecordModalContextType = {
    openRecordModal,
    closeRecordModal,
    isRecordModalOpen: recordPanelState.isOpen,
  }

  return (
    <RecordModalContext.Provider value={value}>
      {children}
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
