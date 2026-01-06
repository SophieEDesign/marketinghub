"use client"

import type { PageBlock } from "@/lib/interface/types"
import { normalizeBlockConfig, isBlockConfigComplete } from "@/lib/interface/block-validator"
import GridBlock from "./blocks/GridBlock"
import FormBlock from "./blocks/FormBlock"
import RecordBlock from "./blocks/RecordBlock"
import ChartBlock from "./blocks/ChartBlock"
import KPIBlock from "./blocks/KPIBlock"
import TextBlock from "./blocks/TextBlock"
import ImageBlock from "./blocks/ImageBlock"
import DividerBlock from "./blocks/DividerBlock"
import ButtonBlock from "./blocks/ButtonBlock"
import TableSnapshotBlock from "./blocks/TableSnapshotBlock"
import ActionBlock from "./blocks/ActionBlock"
import LinkPreviewBlock from "./blocks/LinkPreviewBlock"
import TabsBlock from "./blocks/TabsBlock"
import FilterBlock from "./blocks/FilterBlock"
import { ErrorBoundary } from "./ErrorBoundary"
import type { FilterConfig } from "@/lib/interface/filters"

interface BlockRendererProps {
  block: PageBlock
  isEditing?: boolean
  onUpdate?: (blockId: string, config: Partial<PageBlock["config"]>) => void
  isLocked?: boolean
  pageTableId?: string | null // Table ID from the page
  pageId?: string | null // Page ID
  recordId?: string | null // Record ID for record review pages
  filters?: FilterConfig[] // Filters from filter blocks (for data blocks)
}

export default function BlockRenderer({
  block,
  isEditing = false,
  onUpdate,
  isLocked = false,
  pageTableId = null,
  pageId = null,
  recordId = null,
  filters = [],
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
    
    // Check if config is complete enough to render
    const isComplete = isBlockConfigComplete(block.type, safeConfig)
    
    switch (block.type) {
      case "grid":
        // Grid block MUST have table_id configured - no fallback
        return <GridBlock block={safeBlock} isEditing={canEdit} pageTableId={null} pageId={pageId} filters={filters} />

      case "form":
        // Form block MUST have table_id configured - no fallback
        return (
          <FormBlock
            block={safeBlock}
            isEditing={canEdit}
            pageTableId={null}
            pageId={pageId}
            onSubmit={async (data) => {
              // Handle form submission
              const supabase = await import("@/lib/supabase/client").then((m) => m.createClient())
              const tableId = mergedConfig.table_id
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
        // Record block MUST have table_id and record_id configured - no fallback
        return <RecordBlock block={safeBlock} isEditing={canEdit} pageTableId={null} pageId={pageId} recordId={null} />

      case "chart":
        // Chart block MUST have table_id configured - no fallback
        return <ChartBlock block={safeBlock} isEditing={canEdit} pageTableId={null} pageId={pageId} filters={filters} />

      case "kpi":
        // KPI block MUST have table_id configured - no fallback
        return <KPIBlock block={safeBlock} isEditing={canEdit} pageTableId={null} pageId={pageId} filters={filters} />

      case "filter":
        // Filter block emits filter state via context
        return <FilterBlock block={safeBlock} isEditing={canEdit} pageTableId={pageTableId} pageId={pageId} onUpdate={onUpdate} />

      case "text":
        return <TextBlock block={safeBlock} isEditing={canEdit} onUpdate={onUpdate} />

      case "table_snapshot":
        return <TableSnapshotBlock block={safeBlock} isEditing={canEdit} />

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

      case "tabs":
        return (
          <TabsBlock
            block={safeBlock}
            isEditing={canEdit}
            childBlocks={[]} // TODO: Pass actual child blocks from parent
          />
        )

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
