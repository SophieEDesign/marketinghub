"use client"

import React, { createContext, useContext, useState, useCallback, ReactNode } from "react"

import type { BlockConfig } from "@/lib/interface/types"
import type { RecordEditorCascadeContext } from "@/lib/interface/record-editor-core"

interface RecordPanelState {
  isOpen: boolean
  tableId: string | null
  recordId: string | null
  tableName: string | null
  width: number
  isPinned: boolean
  isFullscreen: boolean
  modalFields?: string[] // Fields to show in modal (if empty, show all)
  modalLayout?: BlockConfig['modal_layout'] // Custom modal layout
  history: Array<{ tableId: string; recordId: string; tableName: string }> // For breadcrumb navigation
  /** When provided, RecordPanel enforces canEditRecords/canDeleteRecords from cascade. */
  cascadeContext?: RecordEditorCascadeContext | null
}

interface RecordPanelContextType {
  state: RecordPanelState
  openRecord: (tableId: string, recordId: string, tableName: string, modalFields?: string[], modalLayout?: BlockConfig['modal_layout'], cascadeContext?: RecordEditorCascadeContext | null) => void
  closeRecord: () => void
  setWidth: (width: number) => void
  togglePin: () => void
  toggleFullscreen: () => void
  navigateToLinkedRecord: (tableId: string, recordId: string, tableName: string) => void
  goBack: () => void
}

const RecordPanelContext = createContext<RecordPanelContextType | undefined>(undefined)

const DEFAULT_WIDTH = 480 // Default panel width in pixels
const MIN_WIDTH = 320
const MAX_WIDTH = 1200

export function RecordPanelProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<RecordPanelState>({
    isOpen: false,
    tableId: null,
    recordId: null,
    tableName: null,
    width: DEFAULT_WIDTH,
    isPinned: false,
    isFullscreen: false,
    history: [],
  })

  const openRecord = useCallback((tableId: string, recordId: string, tableName: string, modalFields?: string[], modalLayout?: BlockConfig['modal_layout'], cascadeContext?: RecordEditorCascadeContext | null) => {
    if (process.env.NODE_ENV === 'development' && cascadeContext === undefined) {
      console.warn('[RecordPanel] Opened without cascadeContext; block-level permissions will not be enforced.')
    }
    setState((prev) => ({
      ...prev,
      isOpen: true,
      tableId,
      recordId,
      tableName,
      modalFields,
      modalLayout,
      cascadeContext,
      history: prev.isOpen && prev.tableId === tableId && prev.recordId === recordId
        ? prev.history // Don't add to history if same record
        : [...prev.history, { tableId, recordId, tableName }],
    }))
  }, [])

  const closeRecord = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isOpen: false,
      // Keep history for potential re-opening
    }))
  }, [])

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

  const navigateToLinkedRecord = useCallback((tableId: string, recordId: string, tableName: string) => {
    setState((prev) => ({
      ...prev,
      tableId,
      recordId,
      tableName,
      cascadeContext: undefined, // Clear when navigating; caller can pass again if needed
      history: [...prev.history, { tableId, recordId, tableName }],
    }))
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

  return (
    <RecordPanelContext.Provider
      value={{
        state,
        openRecord,
        closeRecord,
        setWidth,
        togglePin,
        toggleFullscreen,
        navigateToLinkedRecord,
        goBack,
      }}
    >
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

