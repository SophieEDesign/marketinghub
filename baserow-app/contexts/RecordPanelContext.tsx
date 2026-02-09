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
  /** Interface mode: 'view' | 'edit'. When 'edit', RecordPanel opens in edit mode (Airtable-style). */
  interfaceMode?: 'view' | 'edit'
}

interface RecordPanelContextType {
  state: RecordPanelState
  openRecord: (tableId: string, recordId: string, tableName: string, modalFields?: string[], modalLayout?: BlockConfig['modal_layout'], cascadeContext?: RecordEditorCascadeContext | null, interfaceMode?: 'view' | 'edit') => void
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

  const openRecord = useCallback((tableId: string, recordId: string, tableName: string, modalFields?: string[], modalLayout?: BlockConfig['modal_layout'], cascadeContext?: RecordEditorCascadeContext | null, interfaceMode?: 'view' | 'edit') => {
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
      interfaceMode: interfaceMode ?? prev.interfaceMode ?? 'view', // Preserve existing interfaceMode if not provided
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
    setState((prev) => ({
      ...prev,
      interfaceMode,
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
        openRecordByTableId,
        closeRecord,
        setWidth,
        togglePin,
        toggleFullscreen,
        navigateToLinkedRecord,
        goBack,
        setInterfaceMode,
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

