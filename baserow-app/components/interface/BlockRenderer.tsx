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
import { ErrorBoundary } from "./ErrorBoundary"

interface BlockRendererProps {
  block: PageBlock
  isEditing?: boolean
  onUpdate?: (blockId: string, config: Partial<PageBlock["config"]>) => void
  isLocked?: boolean
}

export default function BlockRenderer({
  block,
  isEditing = false,
  onUpdate,
  isLocked = false,
}: BlockRendererProps) {
  // Normalize config to prevent crashes
  const safeConfig = normalizeBlockConfig(block.type, block.config)
  const safeBlock: PageBlock = {
    ...block,
    config: safeConfig,
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
        return <GridBlock block={safeBlock} isEditing={canEdit} />

      case "form":
        return (
          <FormBlock
            block={safeBlock}
            isEditing={canEdit}
            onSubmit={async (data) => {
              // Handle form submission
              const supabase = await import("@/lib/supabase/client").then((m) => m.createClient())
              const tableId = safeConfig.table_id
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
        return <RecordBlock block={safeBlock} isEditing={canEdit} />

      case "chart":
        return <ChartBlock block={safeBlock} isEditing={canEdit} />

      case "kpi":
        return <KPIBlock block={safeBlock} isEditing={canEdit} />

      case "text":
        return <TextBlock block={safeBlock} isEditing={canEdit} />

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
