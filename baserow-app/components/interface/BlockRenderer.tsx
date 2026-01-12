"use client"

import type { PageBlock } from "@/lib/interface/types"
import { normalizeBlockConfig, isBlockConfigComplete } from "@/lib/interface/block-validator"
import { assertBlockConfig, shouldShowBlockSetupUI } from "@/lib/interface/assertBlockConfig"
import GridBlock from "./blocks/GridBlock"
import FormBlock from "./blocks/FormBlock"
import RecordBlock from "./blocks/RecordBlock"
import ChartBlock from "./blocks/ChartBlock"
import KPIBlock from "./blocks/KPIBlock"
import TextBlock from "./blocks/TextBlock"
import ImageBlock from "./blocks/ImageBlock"
import DividerBlock from "./blocks/DividerBlock"
import ButtonBlock from "./blocks/ButtonBlock"
import ActionBlock from "./blocks/ActionBlock"
import LinkPreviewBlock from "./blocks/LinkPreviewBlock"
import FilterBlock from "./blocks/FilterBlock"
import FieldBlock from "./blocks/FieldBlock"
import CalendarBlock from "./blocks/CalendarBlock"
import KanbanBlock from "./blocks/KanbanBlock"
import TimelineBlock from "./blocks/TimelineBlock"
import ListBlock from "./blocks/ListBlock"
import NumberBlock from "./blocks/NumberBlock"
import { ErrorBoundary } from "./ErrorBoundary"
import type { FilterConfig } from "@/lib/interface/filters"
import LazyBlockWrapper from "./LazyBlockWrapper"

// Module-level Set to track warned blocks across all component instances
const warnedBlocks = new Set<string>()

interface BlockRendererProps {
  block: PageBlock
  isEditing?: boolean
  onUpdate?: (blockId: string, config: Partial<PageBlock["config"]>) => void
  isLocked?: boolean
  pageTableId?: string | null // Table ID from the page
  pageId?: string | null // Page ID
  recordId?: string | null // Record ID for record review pages
  mode?: 'view' | 'edit' | 'review' // Record review mode: view (no editing), edit (full editing), review (content editing without layout)
  filters?: FilterConfig[] // Filters from filter blocks (for data blocks)
  onRecordClick?: (recordId: string) => void // Callback for record clicks (for RecordReview integration)
  aggregateData?: { data: any; error: string | null; isLoading: boolean } // Pre-fetched aggregate data for KPI blocks
  pageEditable?: boolean // Page-level editability (for field blocks)
  editableFieldNames?: string[] // Field-level editable list (for field blocks)
  hideEditButton?: boolean // Hide Edit button for top field blocks (inline editing only)
}

export default function BlockRenderer({
  block,
  isEditing = false,
  onUpdate,
  isLocked = false,
  pageTableId = null,
  pageId = null,
  recordId = null,
  mode = 'view', // Default to view mode
  filters = [],
  onRecordClick,
  aggregateData,
  pageEditable,
  editableFieldNames = [],
  hideEditButton = false,
}: BlockRendererProps) {
  // Normalize config to prevent crashes
  const safeConfig = normalizeBlockConfig(block.type, block.config)
  
  // Merge page context into block config
  // Grid and Form blocks MUST have table_id configured - no fallback
  // Record blocks can use page recordId
  const mergedConfig = {
    ...safeConfig,
    // Only merge recordId for record blocks (not table_id for grid/form)
    record_id: safeConfig.record_id || recordId || undefined,
  }
  
  const safeBlock: PageBlock = {
    ...block,
    config: mergedConfig,
  }

  const handleUpdate = (updates: Partial<PageBlock["config"]>) => {
    if (onUpdate) {
      onUpdate(block.id, updates)
    }
  }

  const renderBlock = () => {
    const canEdit = isEditing && !isLocked
    
    // Pre-deployment guard: Validate block config before rendering
    // Check for all possible date field config properties
    const hasDateField = !!(
      safeConfig.start_date_field ||
      safeConfig.from_date_field ||
      safeConfig.date_field ||
      safeConfig.calendar_date_field ||
      safeConfig.calendar_start_field
    )
    const blockValidity = assertBlockConfig(block.type, safeConfig, {
      pageTableId,
      pageRecordId: recordId,
      hasDateField,
    })
    
    // Show setup UI if block config is invalid
    if (shouldShowBlockSetupUI(block.type, safeConfig, {
      pageTableId,
      pageRecordId: recordId,
      hasDateField,
    }) && !isEditing) {
      // Return setup UI component (blocks handle this internally)
      // But log for diagnostics
      if (!warnedBlocks.has(block.id)) {
        console.warn(`[BlockGuard] Block ${block.id} (${block.type}) showing setup UI: ${blockValidity.reason}`)
        warnedBlocks.add(block.id)
      }
    }
    
    // Check if config is complete enough to render
    const isComplete = isBlockConfigComplete(block.type, safeConfig)
    
    // Deployment safety: Warn (don't crash) if required config is missing
    // Only warn once per block to avoid console spam
    // Image blocks are always valid (can be empty), so skip warning for them
    if (!isComplete && !isEditing && block.type !== 'image' && !warnedBlocks.has(block.id)) {
      // In view mode, log warning but still attempt to render
      console.warn(`[BlockGuard] Block ${block.id} (${block.type}) has incomplete config:`, safeConfig)
      warnedBlocks.add(block.id)
    }
    
    switch (block.type) {
      case "grid":
      case "table":
        // Table blocks use the same rendering as Grid blocks
        // CRITICAL: Pass pageTableId to GridBlock for table resolution fallback
        // Table resolution order: block.config.table_id → page.base_table (pageTableId) → block.config.base_table → null
        // pageTableId must flow to blocks for base_table fallback
        // Lazy-load GridBlock to improve initial page load performance
        // Disable lazy loading in edit mode so users can see all blocks immediately
        return (
          <LazyBlockWrapper enabled={!isEditing}>
            <GridBlock block={safeBlock} isEditing={canEdit} pageTableId={pageTableId} pageId={pageId} filters={filters} onRecordClick={onRecordClick} />
          </LazyBlockWrapper>
        )

      case "form":
        // CRITICAL: Pass pageTableId to FormBlock for table resolution fallback
        // pageTableId must flow to blocks for base_table fallback
        return (
          <FormBlock
            block={safeBlock}
            isEditing={canEdit}
            pageTableId={pageTableId}
            pageId={pageId}
            onSubmit={async (data) => {
              // Handle form submission
              const supabase = await import("@/lib/supabase/client").then((m) => m.createClient())
              // CRITICAL: Use resolved tableId (config first, then pageTableId fallback)
              const tableId = mergedConfig.table_id || pageTableId
              if (tableId) {
                const { data: table } = await supabase
                  .from("tables")
                  .select("supabase_table")
                  .eq("id", tableId)
                  .single()

                if (table?.supabase_table) {
                  await supabase.from(table.supabase_table).insert([data])
                }
              }
            }}
          />
        )

      case "record":
        // CRITICAL: Pass pageTableId to RecordBlock for table resolution fallback
        // record_id can come from config OR from page context (for record review pages)
        // pageTableId must flow to blocks for base_table fallback
        // Lazy-load RecordBlock to improve initial page load performance
        // Disable lazy loading in edit mode so users can see all blocks immediately
        return (
          <LazyBlockWrapper enabled={!isEditing}>
            <RecordBlock block={safeBlock} isEditing={canEdit} pageTableId={pageTableId} pageId={pageId} recordId={recordId} />
          </LazyBlockWrapper>
        )

      case "chart":
        // CRITICAL: Pass pageTableId to ChartBlock for table resolution fallback
        // pageTableId must flow to blocks for base_table fallback
        return <ChartBlock block={safeBlock} isEditing={canEdit} pageTableId={pageTableId} pageId={pageId} filters={filters} />

      case "kpi":
        // CRITICAL: Pass pageTableId to KPIBlock for table resolution fallback
        // pageTableId must flow to blocks for base_table fallback
        // CRITICAL: Pass pre-fetched aggregate data to prevent duplicate requests
        return <KPIBlock block={safeBlock} isEditing={canEdit} pageTableId={pageTableId} pageId={pageId} filters={filters} aggregateData={aggregateData} />

      case "filter":
        // Filter block emits filter state via context
        return <FilterBlock block={safeBlock} isEditing={canEdit} pageTableId={pageTableId} pageId={pageId} onUpdate={onUpdate} />

      case "field":
        // Field block displays field label + value from recordId context
        // Respect page-level editability: if page is editable and field is in editable list (or list is empty), allow editing
        const fieldName = safeConfig?.field_name || ''
        const isFieldEditable = pageEditable !== false && (
          editableFieldNames.length === 0 || editableFieldNames.includes(fieldName)
        )
        // Merge page-level editability into block config
        const fieldBlockConfig = {
          ...safeConfig,
          allow_inline_edit: isFieldEditable && (safeConfig?.allow_inline_edit !== false),
        }
        const fieldBlockWithConfig = {
          ...safeBlock,
          config: fieldBlockConfig,
        }
        return <FieldBlock block={fieldBlockWithConfig} isEditing={canEdit} pageTableId={pageTableId} recordId={recordId} hideEditButton={hideEditButton} />

      case "text":
        // Lazy-load TextBlock to improve initial page load performance
        // Disable lazy loading in edit mode so users can see all blocks immediately
        // CRITICAL: key={block.id} ONLY - no index, no compound keys, no pageId
        return (
          <LazyBlockWrapper enabled={!isEditing}>
            <TextBlock key={block.id} block={safeBlock} isEditing={canEdit} onUpdate={onUpdate} />
          </LazyBlockWrapper>
        )

      case "action":
        return <ActionBlock block={safeBlock} isEditing={canEdit} />

      case "link_preview":
        return <LinkPreviewBlock block={safeBlock} isEditing={canEdit} />

      case "image":
        return (
          <ImageBlock
            block={safeBlock}
            isEditing={canEdit}
            onUpdate={(updates) => handleUpdate(updates)}
          />
        )

      case "divider":
        return <DividerBlock block={safeBlock} isEditing={canEdit} />

      case "button":
        return <ButtonBlock block={safeBlock} isEditing={canEdit} />

      case "calendar":
        // Calendar block - wrapper around GridBlock with view_type='calendar'
        return (
          <LazyBlockWrapper enabled={!isEditing}>
            <CalendarBlock block={safeBlock} isEditing={canEdit} pageTableId={pageTableId} pageId={pageId} filters={filters} onRecordClick={onRecordClick} />
          </LazyBlockWrapper>
        )

      case "kanban":
        // Kanban block - wrapper around GridBlock with view_type='kanban'
        return (
          <LazyBlockWrapper enabled={!isEditing}>
            <KanbanBlock block={safeBlock} isEditing={canEdit} pageTableId={pageTableId} pageId={pageId} filters={filters} onRecordClick={onRecordClick} />
          </LazyBlockWrapper>
        )

      case "timeline":
        // Timeline block - wrapper around GridBlock with view_type='timeline'
        return (
          <LazyBlockWrapper enabled={!isEditing}>
            <TimelineBlock block={safeBlock} isEditing={canEdit} pageTableId={pageTableId} pageId={pageId} filters={filters} onRecordClick={onRecordClick} />
          </LazyBlockWrapper>
        )

      case "list":
        // List block - wrapper around GridBlock with view_type='grid'
        return (
          <LazyBlockWrapper enabled={!isEditing}>
            <ListBlock block={safeBlock} isEditing={canEdit} pageTableId={pageTableId} pageId={pageId} filters={filters} onRecordClick={onRecordClick} />
          </LazyBlockWrapper>
        )

      case "number":
        // Number block - displays a single number field value
        return <NumberBlock block={safeBlock} isEditing={canEdit} pageTableId={pageTableId} recordId={recordId} />

      default:
        return (
          <div className="h-full flex items-center justify-center text-gray-400">
            Unknown block type: {block.type}
          </div>
        )
    }
  }

  return (
    <ErrorBoundary>
      {renderBlock()}
    </ErrorBoundary>
  )
}
