"use client"

import React, { useMemo } from "react"

const EMPTY_FILTERS: import("@/lib/interface/filters").FilterConfig[] = []
import type { PageBlock } from "@/lib/interface/types"
import GridBlock from "./GridBlock"
import type { FilterConfig } from "@/lib/interface/filters"
import type { FilterTree } from "@/lib/filters/canonical-model"

interface CalendarBlockProps {
  block: PageBlock
  isEditing?: boolean
  /** Interface mode: 'view' | 'edit'. When 'edit', all record modals open in edit mode (Airtable-style). */
  interfaceMode?: 'view' | 'edit'
  pageTableId?: string | null
  pageId?: string | null
  recordId?: string | null
  recordTableId?: string | null
  filters?: FilterConfig[]
  filterTree?: FilterTree
  onRecordClick?: (recordId: string, tableId?: string) => void
  pageShowAddRecord?: boolean
  onModalLayoutSave?: (fieldLayout: import("@/lib/interface/field-layout-utils").FieldLayoutItem[]) => void
  canEditLayout?: boolean
  /** When true, use compact Airtable-style top bar and date range from block settings */
  isFullPage?: boolean
}

/**
 * CalendarBlock - Wrapper around GridBlock with view_type='calendar'
 * Displays data in a calendar view.
 * Calendar UI tidying (event cards, tooltips, layout) is implemented in CalendarView.
 * Memoized to prevent excessive re-renders and React error #185.
 * CRITICAL: calendarBlock must be memoized so GridBlock/CalendarView receive a stable
 * reference; a new object every render caused "Maximum update depth exceeded" when
 * opening the record modal.
 */
function CalendarBlock({
  block,
  isEditing = false,
  interfaceMode = 'view',
  pageTableId = null,
  pageId = null,
  recordId = null,
  recordTableId = null,
  filters = [],
  filterTree = null,
  onRecordClick,
  pageShowAddRecord = false,
  onModalLayoutSave,
  canEditLayout = false,
  isFullPage = false,
}: CalendarBlockProps) {
  // #region HOOK CHECK - CalendarBlock render start
  if (process.env.NODE_ENV === 'development') {
    console.log('[HOOK CHECK]', 'CalendarBlock render start', { blockId: block.id })
  }
  // #endregion
  
  // #region HOOK CHECK - Before useMemo configSignature
  if (process.env.NODE_ENV === 'development') {
    console.log('[HOOK CHECK]', 'CalendarBlock before useMemo configSignature')
  }
  // #endregion
  // Memoize so GridBlock (and CalendarView/RecordModal) don't get new props every render.
  // Include modal/layout-related config to avoid stale RecordPanel props that can cause
  // UI flicker (edited layout reverting to basic then back).
  const configSignature = useMemo(() => {
    const cfg = block.config || {}
    return JSON.stringify({
      view_type: cfg.view_type || "",
      table_id: cfg.table_id || "",
      start_date_field: cfg.start_date_field || "",
      end_date_field: cfg.end_date_field || "",
      calendar_start_field: (cfg as any).calendar_start_field || "",
      calendar_end_field: (cfg as any).calendar_end_field || "",
      modal_fields: (cfg as any).modal_fields || null,
      modal_layout: (cfg as any).modal_layout || null,
      field_layout: (cfg as any).field_layout || null,
      permissions: (cfg as any).permissions || null,
      appearance: (cfg as any).appearance || null,
    })
  }, [block.config])
  // #region HOOK CHECK - After useMemo configSignature
  if (process.env.NODE_ENV === 'development') {
    console.log('[HOOK CHECK]', 'CalendarBlock after useMemo configSignature')
  }
  // #endregion
  
  // #region HOOK CHECK - Before useMemo calendarBlock
  if (process.env.NODE_ENV === 'development') {
    console.log('[HOOK CHECK]', 'CalendarBlock before useMemo calendarBlock')
  }
  // #endregion
  const calendarBlock = useMemo<PageBlock>(() => ({
    ...block,
    config: {
      ...block.config,
      view_type: 'calendar',
    },
  }), [
    block.id,
    block.type,
    block.x,
    block.y,
    block.w,
    block.h,
    configSignature, // Use stable signature instead of JSON.stringify
  ])
  // #region HOOK CHECK - After useMemo calendarBlock
  if (process.env.NODE_ENV === 'development') {
    console.log('[HOOK CHECK]', 'CalendarBlock after useMemo calendarBlock')
  }
  // #endregion

  // #region HOOK CHECK - Before useMemo gridBlockProps
  if (process.env.NODE_ENV === 'development') {
    console.log('[HOOK CHECK]', 'CalendarBlock before useMemo gridBlockProps')
  }
  // #endregion
  // Memoize props object to prevent React #185: avoid passing new object reference every render
  const gridBlockProps = useMemo(
    () => ({
      block: calendarBlock,
      isEditing,
      interfaceMode,
      pageTableId,
      pageId,
      recordId,
      recordTableId,
      filters: filters?.length ? filters : EMPTY_FILTERS,
      filterTree,
      onRecordClick,
      pageShowAddRecord,
      onModalLayoutSave,
      canEditLayout,
      isFullPage,
    }),
    [
      calendarBlock,
      isEditing,
      interfaceMode,
      pageTableId,
      pageId,
      recordId,
      recordTableId,
      filters,
      filterTree,
      onRecordClick,
      pageShowAddRecord,
      onModalLayoutSave,
      canEditLayout,
      isFullPage,
    ]
  )
  // #region HOOK CHECK - After useMemo gridBlockProps
  if (process.env.NODE_ENV === 'development') {
    console.log('[HOOK CHECK]', 'CalendarBlock after useMemo gridBlockProps')
  }
  // #endregion

  return <GridBlock key={block.id} {...gridBlockProps} />
}

export default React.memo(CalendarBlock)
