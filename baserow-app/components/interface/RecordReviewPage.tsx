"use client"

/**
 * Record Review Page Component
 * 
 * Layout Structure:
 * ┌──────────────────────────┬──────────────────────────────────────┐
 * │ FIXED LEFT COLUMN         │ RIGHT CANVAS                          │
 * │ (RecordReviewLeftColumn)  │ (InterfaceBuilder with blocks)        │
 * │                           │                                      │
 * │ - Record list             │ - Free canvas                         │
 * │ - Search/filter           │ - Blocks render here                  │
 * │ - Field visibility        │ - Receives recordId context          │
 * └──────────────────────────┴──────────────────────────────────────┘
 * 
 * Key Rules:
 * - Left column is structural (not a block, not draggable)
 * - Right side is normal canvas (blocks only)
 * - Only right side persists layout
 * - recordId is ephemeral UI state (never saved to blocks)
 * - Record selection does NOT trigger block reloads
 */

import { useState, useCallback, useMemo } from "react"
import RecordReviewLeftColumn from "./RecordReviewLeftColumn"
import InterfaceBuilder from "./InterfaceBuilder"
import type { Page, PageBlock } from "@/lib/interface/types"
import type { PageConfig } from "@/lib/interface/page-config"

interface RecordReviewPageProps {
  page: Page
  initialBlocks: PageBlock[]
  isViewer?: boolean
  onSave?: () => void
  onEditModeChange?: (isEditing: boolean) => void
  hideHeader?: boolean
}

export default function RecordReviewPage({
  page,
  initialBlocks,
  isViewer = false,
  onSave,
  onEditModeChange,
  hideHeader = false,
}: RecordReviewPageProps) {
  // CRITICAL: recordId is ephemeral UI state - never saved to blocks or page config
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null)

  // Get tableId and leftPanel settings from page.settings or page.config (single source of truth)
  // InterfacePage uses config, Page type uses settings - handle both
  // CRITICAL: RecordViewPageSettings saves to config.left_panel (snake_case), so check both formats
  const pageConfig: PageConfig | any = (page as any).config || page.settings || {}
  const pageTableId = pageConfig.tableId || pageConfig.primary_table_id || page.settings?.tableId || page.settings?.primary_table_id || null
  // Check both left_panel (snake_case) and leftPanel (camelCase) for backward compatibility
  const leftPanelSettings = pageConfig.left_panel || pageConfig.leftPanel || page.settings?.left_panel || page.settings?.leftPanel

  // Page-level default for "Add record" (used across the interface; blocks can override)
  const pageShowAddRecord =
    pageConfig.show_add_record === true ||
    pageConfig.showAddRecord === true ||
    (page.settings as any)?.show_add_record === true ||
    (page.settings as any)?.showAddRecord === true
  
  // Determine page type from page object (for record_view vs record_review)
  const pageType = (page as any).page_type || (page as any).type || 'record_review'

  // Handle record selection
  // CRITICAL: This does NOT trigger block reloads - blocks just re-render with new context
  const handleRecordSelect = useCallback((recordId: string) => {
    console.log(`[RecordReviewPage] Record selected: ${recordId}`)
    setSelectedRecordId(recordId)
    // NO block reload - blocks will receive new recordId via props and re-render
  }, [])

  // Get edit mode from InterfaceBuilder
  const [isEditing, setIsEditing] = useState(false)

  return (
    <div className="flex h-full w-full">
      {/* Fixed Left Column - Always Present */}
      {/* CRITICAL: Left column reads from page.settings.leftPanel - not from blocks or props */}
      <RecordReviewLeftColumn
        pageId={page.id}
        tableId={pageTableId}
        selectedRecordId={selectedRecordId}
        onRecordSelect={handleRecordSelect}
        leftPanelSettings={leftPanelSettings}
        pageType={pageType as 'record_view' | 'record_review'}
        showAddRecord={pageShowAddRecord}
        pageConfig={pageConfig}
      />

      {/* Right Canvas - Blocks Only */}
      {/* CRITICAL: Container must have min-width: 0 to prevent flex collapse */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0 w-full">
        {/* CRITICAL: Use stable key based on page.id only - NOT recordId
            This ensures blocks don't remount when record changes, they just re-render with new context */}
        {/* CRITICAL: Key is ONLY page.id - never include recordId, mode, or isViewer */}
        {/* This ensures InterfaceBuilder never remounts when record changes or mode toggles */}
        <InterfaceBuilder
          key={page.id} // CRITICAL: ONLY page.id - recordId changes don't cause remounts
          page={page}
          initialBlocks={initialBlocks}
          isViewer={isViewer}
          onSave={onSave}
          onEditModeChange={(editing) => {
            setIsEditing(editing)
            onEditModeChange?.(editing)
          }}
          hideHeader={hideHeader}
          pageTableId={pageTableId}
          recordId={selectedRecordId} // Ephemeral - passed as context, never saved to blocks
          mode={isEditing ? 'edit' : 'view'}
        />
      </div>
    </div>
  )
}
