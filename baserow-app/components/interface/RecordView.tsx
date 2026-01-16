"use client"

/**
 * Record View Component
 * 
 * Combines:
 * 1. Record Field Panel (structured table of selected fields)
 * 2. Block Canvas (flexible layout blocks)
 * 
 * Layout:
 * - Field Panel: Top section (or left sidebar option)
 * - Block Canvas: Main content area below (or right of) field panel
 * 
 * This replaces the need for separate "form view" and "record view" - 
 * everything is unified in one flexible, block-based interface.
 */

import { useState, useCallback, useMemo } from "react"
import RecordFieldPanel from "@/components/records/RecordFieldPanel"
import InterfaceBuilder from "./InterfaceBuilder"
import type { Page, PageBlock } from "@/lib/interface/types"
import type { TableField } from "@/types/fields"

interface FieldConfig {
  field: string // Field name or ID
  editable: boolean
  order?: number
}

interface RecordViewConfig {
  table: string // Table ID
  fields: FieldConfig[] // Selected fields for field panel
  blocks?: PageBlock[] // Blocks for the canvas (optional, can be loaded separately)
}

interface RecordViewProps {
  page: Page
  initialBlocks: PageBlock[]
  recordId: string | null // Current record ID
  isViewer?: boolean
  onSave?: () => void
  onEditModeChange?: (isEditing: boolean) => void
  hideHeader?: boolean
  // Configuration
  config?: RecordViewConfig
  allFields?: TableField[] // All available fields from the table
  // Layout options
  fieldPanelPosition?: "top" | "left" // Position of field panel
  fieldPanelCollapsible?: boolean // Allow collapsing field panel
}

export default function RecordView({
  page,
  initialBlocks,
  recordId,
  isViewer = false,
  onSave,
  onEditModeChange,
  hideHeader = false,
  config,
  allFields = [],
  fieldPanelPosition = "top",
  fieldPanelCollapsible = false,
}: RecordViewProps) {
  const [fieldPanelCollapsed, setFieldPanelCollapsed] = useState(false)
  const [isEditing, setIsEditing] = useState(false)

  // Get configuration from page settings or props
  const pageConfig = (page as any).config || page.settings || {}
  const recordViewConfig: RecordViewConfig = config || {
    table: pageConfig.tableId || pageConfig.primary_table_id || "",
    fields: pageConfig.recordView?.fields || [],
    blocks: initialBlocks,
  }

  const tableId = recordViewConfig.table
  const fieldConfigs = recordViewConfig.fields || []

  // Handle field change
  const handleFieldChange = useCallback((fieldName: string, value: any) => {
    // Field changes are handled by RecordFieldPanel internally
    // This callback can be used for additional side effects if needed
  }, [])

  // Handle linked record click
  const handleLinkedRecordClick = useCallback((linkedTableId: string, linkedRecordId: string) => {
    // Never open the current record (self-link edge case)
    if (linkedTableId === tableId && linkedRecordId === recordId) {
      return
    }
    // Navigate to the linked record's record view
    window.location.href = `/tables/${linkedTableId}/records/${linkedRecordId}`
  }, [tableId, recordId])

  // Get edit mode from InterfaceBuilder
  const handleEditModeChange = useCallback((editing: boolean) => {
    setIsEditing(editing)
    onEditModeChange?.(editing)
  }, [onEditModeChange])

  // Render field panel
  const renderFieldPanel = () => {
    if (!tableId || fieldConfigs.length === 0) {
      return null
    }

    return (
      <div className={fieldPanelPosition === "left" ? "w-80 flex-shrink-0 border-r border-gray-200" : "w-full border-b border-gray-200"}>
        {fieldPanelCollapsible && (
          <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Record Fields</h3>
            <button
              onClick={() => setFieldPanelCollapsed(!fieldPanelCollapsed)}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              {fieldPanelCollapsed ? "Expand" : "Collapse"}
            </button>
          </div>
        )}
        {!fieldPanelCollapsed && (
          <div className="p-4 overflow-y-auto" style={{ maxHeight: fieldPanelPosition === "top" ? "300px" : "100%" }}>
            <RecordFieldPanel
              tableId={tableId}
              recordId={recordId}
              fields={fieldConfigs}
              allFields={allFields}
              onFieldChange={handleFieldChange}
              onLinkedRecordClick={handleLinkedRecordClick}
              compact={fieldPanelPosition === "top"}
            />
          </div>
        )}
      </div>
    )
  }

  // Render block canvas
  const renderBlockCanvas = () => {
    return (
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <InterfaceBuilder
          key={page.id}
          page={page}
          initialBlocks={initialBlocks}
          isViewer={isViewer}
          onSave={onSave}
          onEditModeChange={handleEditModeChange}
          hideHeader={hideHeader}
          pageTableId={tableId}
          recordId={recordId}
          mode={isEditing ? 'edit' : 'view'}
        />
      </div>
    )
  }

  if (fieldPanelPosition === "left") {
    return (
      <div className="flex h-full w-full">
        {/* Left: Field Panel */}
        {renderFieldPanel()}
        {/* Right: Block Canvas */}
        {renderBlockCanvas()}
      </div>
    )
  } else {
    return (
      <div className="flex flex-col h-full w-full">
        {/* Top: Field Panel */}
        {renderFieldPanel()}
        {/* Bottom: Block Canvas */}
        {renderBlockCanvas()}
      </div>
    )
  }
}
