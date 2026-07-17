"use client"

import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode } from "react"
import { useSelectionContext } from "@/contexts/SelectionContext"

import type { BlockConfig } from "@/lib/interface/types"
import type { RecordEditorCascadeContext } from "@/lib/interface/record-editor-core"
import type { FieldLayoutItem } from "@/lib/interface/field-layout-utils"
import type { RecordLayoutType } from "@/lib/records/record-layout-presets"
import {
  defaultRecordDrawerMode,
  type EventRecordContextualPayload,
  type RecordDrawerMode,
} from "@/lib/records/record-drawer-mode"
import { inferRecordLayoutTypeFromTableName } from "@/lib/records/infer-record-layout-type"
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
  history: Array<{ tableId: string; recordId: string; tableName: string | null }> // For breadcrumb navigation
  /** When provided, RecordPanel enforces canEditRecords/canDeleteRecords from cascade. */
  cascadeContext?: RecordEditorCascadeContext | null
  /** Interface mode: 'view' | 'edit'. When 'edit', RecordPanel opens in edit mode (Airtable-style). */
  interfaceMode?: 'view' | 'edit'
  recordLayoutType?: RecordLayoutType
  /** Contextual drawer mode for custom layouts (event calendar uses view + edit in one panel). */
  recordDrawerMode: RecordDrawerMode
  /** Rich event overview when opened from Event Calendar (optional). */
  eventContextual?: EventRecordContextualPayload | null
  /** Called when the record is deleted; blocks use this to refresh core data (grid/calendar). */
  onRecordDeleted?: () => void
  /** Called when a field is updated; views use this to refresh row data (e.g. card color from status). */
  onRecordUpdated?: () => void
  /** Create mode only: initial data for new record (e.g. date from day-cell click). */
  initialData?: Record<string, any>
  /** Create mode only: called when record is saved with new id. */
  onRecordCreated?: (createdRecordId: string) => void
  /** Bumps when a new panel session starts; stable through create → edit promotion. */
  panelSessionId: number
}

export interface OpenRecordOptions {
  initialDrawerMode?: RecordDrawerMode
  eventContextual?: EventRecordContextualPayload | null
}

interface RecordPanelContextType {
  state: RecordPanelState
  openRecord: (
    tableId: string,
    recordId: string,
    tableName: string | null,
    modalFields?: string[],
    modalLayout?: BlockConfig["modal_layout"],
    cascadeContext?: RecordEditorCascadeContext | null,
    interfaceMode?: "view" | "edit",
    onRecordDeleted?: () => void,
    onRecordUpdated?: () => void,
    fieldLayout?: FieldLayoutItem[],
    onLayoutSave?: (layout: FieldLayoutItem[]) => void | Promise<void>,
    tableFields?: TableField[],
    recordLayoutType?: RecordLayoutType,
    drawerOptions?: OpenRecordOptions
  ) => void
  /** Open panel in create mode (same UI as edit). */
  openRecordForCreate: (params: {
    tableId: string
    tableName: string | null
    tableFields?: TableField[]
    modalFields?: string[]
    modalLayout?: BlockConfig["modal_layout"]
    initialData?: Record<string, any>
    cascadeContext?: RecordEditorCascadeContext | null
    onRecordCreated?: (createdRecordId: string) => void
    recordLayoutType?: RecordLayoutType
  }) => void
  /** Fetches table supabase_table by id and opens the record in the panel. Use when only tableId + recordId are available (e.g. linked record click). */
  openRecordByTableId: (tableId: string, recordId: string, interfaceMode?: 'view' | 'edit') => Promise<void>
  closeRecord: () => void
  setWidth: (width: number) => void
  togglePin: () => void
  toggleFullscreen: () => void
  navigateToLinkedRecord: (tableId: string, recordId: string, tableName: string | null, interfaceMode?: 'view' | 'edit') => void
  goBack: () => void
  /** Set interface mode for RecordPanel (called by InterfaceBuilder when edit mode changes). */
  setInterfaceMode: (interfaceMode: 'view' | 'edit') => void
  /** Live layout update: immediately reflects in RecordEditor without save. Right panel calls this when draft changes. */
  setFieldLayout: (layout: FieldLayoutItem[]) => void
  /** Switch contextual drawer between overview and edit without reopening. */
  setRecordDrawerMode: (mode: RecordDrawerMode) => void
  /** After create save: assign recordId in place without remounting or reloading. */
  promoteCreateRecord: (createdRecordId: string) => void
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
    recordDrawerMode: "edit",
    eventContextual: null,
    panelSessionId: 0,
  })

  const openRecord = useCallback((
    tableId: string,
    recordId: string,
    tableName: string | null,
    modalFields?: string[],
    modalLayout?: BlockConfig["modal_layout"],
    cascadeContext?: RecordEditorCascadeContext | null,
    interfaceMode?: "view" | "edit",
    onRecordDeleted?: () => void,
    onRecordUpdated?: () => void,
    fieldLayout?: FieldLayoutItem[],
    onLayoutSave?: (layout: FieldLayoutItem[]) => void | Promise<void>,
    tableFields?: TableField[],
    recordLayoutType?: RecordLayoutType,
    drawerOptions?: OpenRecordOptions
  ) => {
    if (process.env.NODE_ENV === "development" && cascadeContext === undefined) {
      console.warn("[RecordPanel] Opened without cascadeContext; block-level permissions will not be enforced.")
    }
    const layoutType = recordLayoutType ?? "generic"
    const drawerMode = defaultRecordDrawerMode(layoutType, drawerOptions?.initialDrawerMode)
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
      onRecordUpdated,
      recordLayoutType: layoutType,
      recordDrawerMode: drawerMode,
      eventContextual:
        layoutType === "event" ? drawerOptions?.eventContextual ?? null : null,
      initialData: undefined,
      onRecordCreated: undefined,
      history:
        prev.isOpen && prev.tableId === tableId && prev.recordId === recordId
          ? prev.history
          : [...prev.history, { tableId, recordId, tableName }],
      panelSessionId:
        prev.isOpen && prev.tableId === tableId && prev.recordId === recordId
          ? prev.panelSessionId
          : prev.panelSessionId + 1,
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

  const navigateToLinkedRecord = useCallback((tableId: string, recordId: string, tableName: string | null, interfaceMode?: 'view' | 'edit') => {
    const layoutType = inferRecordLayoutTypeFromTableName(tableName)
    setState((prev) => ({
      ...prev,
      tableId,
      recordId,
      tableName,
      cascadeContext: undefined, // Clear when navigating; caller can pass again if needed
      interfaceMode: interfaceMode ?? prev.interfaceMode ?? 'view', // Preserve interfaceMode when navigating
      recordLayoutType: layoutType,
      recordDrawerMode: defaultRecordDrawerMode(layoutType, "edit"),
      eventContextual: layoutType === "event" ? prev.eventContextual ?? null : null,
      history: [...prev.history, { tableId, recordId, tableName }],
    }))
  }, [])

  const openRecordForCreate = useCallback((params: {
    tableId: string
    tableName: string | null
    tableFields?: TableField[]
    modalFields?: string[]
    modalLayout?: BlockConfig["modal_layout"]
    initialData?: Record<string, any>
    cascadeContext?: RecordEditorCascadeContext | null
    onRecordCreated?: (createdRecordId: string) => void
    recordLayoutType?: RecordLayoutType
  }) => {
    setSelectedContext({ type: "record", recordId: "__create__", tableId: params.tableId })
    setState((prev) => ({
      ...prev,
      isOpen: true,
      tableId: params.tableId,
      recordId: null,
      tableName: params.tableName,
      modalFields: params.modalFields,
      modalLayout: params.modalLayout,
      tableFields: params.tableFields,
      cascadeContext: params.cascadeContext,
      interfaceMode: "edit",
      initialData: params.initialData,
      onRecordCreated: params.onRecordCreated,
      recordLayoutType: params.recordLayoutType ?? "generic",
      recordDrawerMode: defaultRecordDrawerMode(
        params.recordLayoutType ?? "generic",
        "edit"
      ),
      eventContextual: null,
      history: [],
      panelSessionId: prev.panelSessionId + 1,
    }))
  }, [setSelectedContext])

  const promoteCreateRecord = useCallback((createdRecordId: string) => {
    let tableIdForContext: string | null = null
    setState((prev) => {
      if (!prev.isOpen || !prev.tableId || prev.recordId != null) return prev
      tableIdForContext = prev.tableId
      return {
        ...prev,
        recordId: createdRecordId,
        initialData: undefined,
        onRecordCreated: undefined,
        interfaceMode: prev.interfaceMode ?? "edit",
        history:
          prev.history.length > 0
            ? prev.history
            : [
                {
                  tableId: prev.tableId,
                  recordId: createdRecordId,
                  tableName: prev.tableName,
                },
              ],
      }
    })
    if (tableIdForContext) {
      setSelectedContext({ type: "record", recordId: createdRecordId, tableId: tableIdForContext })
    }
  }, [setSelectedContext])

  const setRecordDrawerMode = useCallback((mode: RecordDrawerMode) => {
    setState((prev) => {
      if (!prev.isOpen) return prev
      if (prev.recordDrawerMode === mode) return prev
      return { ...prev, recordDrawerMode: mode }
    })
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

  const setFieldLayout = useCallback((layout: FieldLayoutItem[]) => {
    setState((prev) => {
      if (!prev.isOpen || !prev.recordId) return prev
      if (prev.fieldLayout === layout) return prev
      return { ...prev, fieldLayout: layout }
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
    openRecordForCreate,
    openRecordByTableId,
    closeRecord,
    setWidth,
    togglePin,
    toggleFullscreen,
    navigateToLinkedRecord,
    goBack,
    setInterfaceMode,
    setFieldLayout,
    setRecordDrawerMode,
    promoteCreateRecord,
  }), [
    state,
    openRecord,
    openRecordForCreate,
    openRecordByTableId,
    closeRecord,
    setWidth,
    togglePin,
    toggleFullscreen,
    navigateToLinkedRecord,
    goBack,
    setInterfaceMode,
    setFieldLayout,
    setRecordDrawerMode,
    promoteCreateRecord,
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

