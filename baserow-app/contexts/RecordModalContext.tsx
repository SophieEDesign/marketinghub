"use client"

import React, { createContext, useContext, useState, useCallback, useRef, ReactNode } from "react"
import { useSelectionContext } from "@/contexts/SelectionContext"
import type { TableField } from "@/types/fields"
import type { BlockConfig } from "@/lib/interface/types"
import type { RecordEditorCascadeContext } from "@/lib/interface/record-editor-core"
import type { FieldLayoutItem } from "@/lib/interface/field-layout-utils"
import RecordModal from "@/components/calendar/RecordModal"

/** State for opening the global RecordModal. Mirrors RecordModalProps. */
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
  /** Optional key suffix for modal remount (e.g. blockId) */
  keySuffix?: string
}

interface RecordModalContextType {
  /** Open the global RecordModal with the given state. */
  openRecordModal: (state: RecordModalOpenState) => void
  /** Close the global RecordModal. */
  closeRecordModal: () => void
  /** True when RecordModal is open (used to hide PageDisplaySettingsPanel per plan Step 4). */
  isRecordModalOpen: boolean
}

const RecordModalContext = createContext<RecordModalContextType | undefined>(undefined)

export function RecordModalProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<RecordModalOpenState | null>(null)
  const onCloseRef = useRef<(() => void) | null>(null)
  const { setSelectedContext } = useSelectionContext()

  const openRecordModal = useCallback((openState: RecordModalOpenState) => {
    setState(openState)
    // Sync with SelectionContext for single-active-context rule
    if (openState.recordId) {
      setSelectedContext({ type: "record", recordId: openState.recordId, tableId: openState.tableId })
    }
  }, [setSelectedContext])

  const closeRecordModal = useCallback(() => {
    setState(null)
    setSelectedContext(null)
  }, [setSelectedContext])

  const handleClose = useCallback(() => {
    closeRecordModal()
  }, [closeRecordModal])

  const handleSave = useCallback(
    (createdRecordId?: string | null) => {
      state?.onSave?.(createdRecordId)
      closeRecordModal()
    },
    [state, closeRecordModal]
  )

  const handleDeleted = useCallback(async () => {
    await state?.onDeleted?.()
    closeRecordModal()
  }, [state, closeRecordModal])

  return (
    <RecordModalContext.Provider value={{ openRecordModal, closeRecordModal, isRecordModalOpen: !!state }}>
      {children}
      {/* CRITICAL: RecordModal mounts once, always in the same position. Control via props. Never conditional. */}
      <RecordModal
        key="record-modal-global"
        open={!!state}
        onClose={handleClose}
        tableId={state?.tableId ?? ""}
        recordId={state?.recordId ?? null}
        tableFields={state?.tableFields}
        modalFields={state?.modalFields}
        initialData={state?.initialData}
        supabaseTableName={state?.supabaseTableName}
        modalLayout={state?.modalLayout}
        fieldLayout={state?.fieldLayout}
        showFieldSections={state?.showFieldSections}
        cascadeContext={state?.cascadeContext}
        canEditLayout={state?.canEditLayout}
        onLayoutSave={state?.onLayoutSave}
        initialEditMode={state?.initialEditMode}
        interfaceMode={state?.interfaceMode ?? "view"}
        onSave={handleSave}
        onDeleted={handleDeleted}
      />
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
