"use client"

/**
 * RecordModalContext — DELEGATE TO RecordPanel
 *
 * All record editing uses the right-side RecordPanel only.
 * openRecordModal delegates to RecordPanelContext.openRecord.
 * No modal component is rendered.
 */

import React, { createContext, useContext, useCallback, ReactNode } from "react"
import { useRecordPanel } from "@/contexts/RecordPanelContext"
import type { TableField } from "@/types/fields"
import type { BlockConfig } from "@/lib/interface/types"
import type { RecordEditorCascadeContext } from "@/lib/interface/record-editor-core"
import type { FieldLayoutItem } from "@/lib/interface/field-layout-utils"

/** State for opening record (delegates to RecordPanel). */
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
  /** Always false — modal removed; all editing in RecordPanel */
  isRecordModalOpen: boolean
}

const RecordModalContext = createContext<RecordModalContextType | undefined>(undefined)

export function RecordModalProvider({ children }: { children: ReactNode }) {
  const { openRecord, closeRecord } = useRecordPanel()

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
      }
      // Create mode (recordId null): RecordPanel does not support yet — skip for now
    },
    [openRecord]
  )

  const closeRecordModal = useCallback(() => {
    closeRecord()
  }, [closeRecord])

  const value: RecordModalContextType = {
    openRecordModal,
    closeRecordModal,
    isRecordModalOpen: false,
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
