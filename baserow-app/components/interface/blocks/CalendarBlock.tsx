"use client"

import React, { useMemo } from "react"
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
  filters = [],
  filterTree = null,
  onRecordClick,
  pageShowAddRecord = false,
  onModalLayoutSave,
  canEditLayout = false,
  isFullPage = false,
}: CalendarBlockProps) {
  // Memoize so GridBlock (and CalendarView/RecordModal) don't get new props every render.
  // CRITICAL: Extract config values to prevent JSON.stringify from causing re-renders
  // JSON.stringify creates a new string every render even if config hasn't changed
  const configSignature = useMemo(() => {
    const cfg = block.config || {}
    return `${block.id}-${cfg.view_type || ''}-${cfg.table_id || ''}-${cfg.start_date_field || ''}-${cfg.end_date_field || ''}`
  }, [block.id, block.config?.view_type, block.config?.table_id, block.config?.start_date_field, block.config?.end_date_field])
  
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

  return (
    <GridBlock
      block={calendarBlock}
      isEditing={isEditing}
      interfaceMode={interfaceMode}
      pageTableId={pageTableId}
      pageId={pageId}
      filters={filters}
      filterTree={filterTree}
      onRecordClick={onRecordClick}
      pageShowAddRecord={pageShowAddRecord}
      onModalLayoutSave={onModalLayoutSave}
      canEditLayout={canEditLayout}
      isFullPage={isFullPage}
    />
  )
}

export default React.memo(CalendarBlock)
