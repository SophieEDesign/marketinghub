"use client"

import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode } from "react"
import { useSelectionContext } from "@/contexts/SelectionContext"

import type { BlockConfig } from "@/lib/interface/types"
import type { RecordEditorCascadeContext } from "@/lib/interface/record-editor-core"
import type { FieldLayoutItem } from "@/lib/interface/field-layout-utils"
import type { TableField } from "@/types/fields"

interface RecordPanelState {
  isOpen: boolean
  tableId: string | null
  recordId: string | null
  tableName: string | null
  width: number
  isPinned: boolean
  isFullscreen: boolean
  modalFields?: string[]
  modalLayout?: BlockConfig["modal_layout"]
  fieldLayout?: FieldLayoutItem[]
  onLayoutSave?: (layout: FieldLayoutItem[]) => void | Promise<void>
  tableFields?: TableField[]
  history: Array<{ tableId: string; recordId: string; tableName: string }> // For breadcrumb navigation
  /** When provided, RecordPanel enforces canEditRecords/canDeleteRecords from cascade. */
  cascadeContext?: RecordEditorCascadeContext | null
  /** Interface mode: 'view' | 'edit'. When 'edit', RecordPanel opens in edit mode (Airtable-style). */
  interfaceMode?: 'view' | 'edit'
  /** Called when the record is deleted; blocks use this to refresh core data (grid/calendar). */
  onRecordDeleted?: () => void
}

interface RecordPanelContextType {
  state: RecordPanelState
  openRecord: (tableId: string, recordId: string, tableName: string, modalFields?: string[], modalLayout?: BlockConfig["modal_layout"], cascadeContext?: RecordEditorCascadeContext | null, interfaceMode?: "view" | "edit", onRecordDeleted?: () => void, fieldLayout?: FieldLayoutItem[], onLayoutSave?: (layout: FieldLayoutItem[]) => void | Promise<void>, tableFields?: TableField[]) => void
  /** Fetches table supabase_table by id and opens the record in the panel. Use when only tableId + recordId are available (e.g. linked record click). */
  openRecordByTableId: (tableId: string, recordId: string, interfaceMode?: 'view' | 'edit') => Promise<void>
  closeRecord: () => void
  setWidth: (width: number) => void
  togglePin: () => void
  toggleFullscreen: () => void
  navigateToLinkedRecord: (tableId: string, recordId: string, tableName: string, interfaceMode?: 'view' | 'edit') => void
  goBack: () => void
  /** Set interface mode for RecordPanel (called by InterfaceBuilder when edit mode changes). */
  setInterfaceMode: (interfaceMode: 'view' | 'edit') => void
}

const RecordPanelContext = createContext<RecordPanelContextType | undefined>(undefined)

const DEFAULT_WIDTH = 480 // Default panel width in pixels
const MIN_WIDTH = 320
const MAX_WIDTH = 1200

export function RecordPanelProvider({ children }: { children: ReactNode }) {
  const { setSelectedContext } = useSelectionContext()
  const [state, setState] = useState<RecordPanelState>({
    isOpen: false,
    tableId: null,
    recordId: null,
    tableName: null,
    width: DEFAULT_WIDTH,
    isPinned: false,
    isFullscreen: false,
    history: [],
    interfaceMode: 'view', // Default to view mode
  })

  const openRecord = useCallback((
    tableId: string,
    recordId: string,
    tableName: string,
    modalFields?: string[],
    modalLayout?: BlockConfig["modal_layout"],
    cascadeContext?: RecordEditorCascadeContext | null,
    interfaceMode?: "view" | "edit",
    onRecordDeleted?: () => void,
    fieldLayout?: FieldLayoutItem[],
    onLayoutSave?: (layout: FieldLayoutItem[]) => void | Promise<void>,
    tableFields?: TableField[]
  ) => {
    if (process.env.NODE_ENV === "development" && cascadeContext === undefined) {
      console.warn("[RecordPanel] Opened without cascadeContext; block-level permissions will not be enforced.")
    }
    setSelectedContext({ type: "record", recordId, tableId })
    setState((prev) => ({
      ...prev,
      isOpen: true,
      tableId,
      recordId,
      tableName,
      modalFields,
      modalLayout,
      fieldLayout,
      onLayoutSave,
      tableFields,
      cascadeContext,
      interfaceMode: interfaceMode ?? prev.interfaceMode ?? "view",
      onRecordDeleted,
      history:
        prev.isOpen && prev.tableId === tableId && prev.recordId === recordId
          ? prev.history
          : [...prev.history, { tableId, recordId, tableName }],
    }))
    // Per architectural contract: do NOT call setRightPanelData. Inspector reads from selection.
  }, [setSelectedContext])

  const closeRecord = useCallback(() => {
    setSelectedContext(null)
    setState((prev) => ({
      ...prev,
      isOpen: false,
      // Keep history for potential re-opening
    }))
    // Per architectural contract: do NOT call setRightPanelData. Inspector derives from selection.
  }, [setSelectedContext])

  const setWidth = useCallback((width: number) => {
    const clampedWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, width))
    setState((prev) => ({
      ...prev,
      width: clampedWidth,
    }))
  }, [])

  const togglePin = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isPinned: !prev.isPinned,
    }))
  }, [])

  const toggleFullscreen = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isFullscreen: !prev.isFullscreen,
    }))
  }, [])

  const navigateToLinkedRecord = useCallback((tableId: string, recordId: string, tableName: string, interfaceMode?: 'view' | 'edit') => {
    setState((prev) => ({
      ...prev,
      tableId,
      recordId,
      tableName,
      cascadeContext: undefined, // Clear when navigating; caller can pass again if needed
      interfaceMode: interfaceMode ?? prev.interfaceMode ?? 'view', // Preserve interfaceMode when navigating
      history: [...prev.history, { tableId, recordId, tableName }],
    }))
  }, [])

  const openRecordByTableId = useCallback(async (tableId: string, recordId: string, interfaceMode?: 'view' | 'edit') => {
    try {
      const res = await fetch(`/api/tables/${tableId}`)
      if (!res.ok) return
      const { table } = await res.json()
      const tableName = table?.supabase_table
      if (tableName) {
        openRecord(tableId, recordId, tableName, undefined, undefined, undefined, interfaceMode)
      }
    } catch (err) {
      console.error('[RecordPanel] openRecordByTableId failed:', err)
    }
  }, [openRecord])

  const setInterfaceMode = useCallback((interfaceMode: 'view' | 'edit') => {
    setState((prev) => {
      if (prev.interfaceMode === interfaceMode) return prev
      return { ...prev, interfaceMode }
    })
  }, [])

  const goBack = useCallback(() => {
    setState((prev) => {
      if (prev.history.length <= 1) {
        return prev // Can't go back if only one record in history
      }
      const newHistory = [...prev.history]
      newHistory.pop() // Remove current record
      const previous = newHistory[newHistory.length - 1]
      return {
        ...prev,
        tableId: previous.tableId,
        recordId: previous.recordId,
        tableName: previous.tableName,
        cascadeContext: undefined,
        history: newHistory,
      }
    })
  }, [])

  const contextValue = useMemo(() => ({
    state,
    openRecord,
    openRecordByTableId,
    closeRecord,
    setWidth,
    togglePin,
    toggleFullscreen,
    navigateToLinkedRecord,
    goBack,
    setInterfaceMode,
  }), [
    state,
    openRecord,
    openRecordByTableId,
    closeRecord,
    setWidth,
    togglePin,
    toggleFullscreen,
    navigateToLinkedRecord,
    goBack,
    setInterfaceMode,
  ])

  return (
    <RecordPanelContext.Provider value={contextValue}>
      {children}
    </RecordPanelContext.Provider>
  )
}

export function useRecordPanel() {
  const context = useContext(RecordPanelContext)
  if (!context) {
    throw new Error("useRecordPanel must be used within RecordPanelProvider")
  }
  return context
}

