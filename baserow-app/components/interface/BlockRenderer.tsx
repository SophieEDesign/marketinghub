"use client"

import type { PageBlock } from "@/lib/interface/types"
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
  const handleUpdate = (updates: Partial<PageBlock["config"]>) => {
    if (onUpdate) {
      onUpdate(block.id, updates)
    }
  }

  const renderBlock = () => {
    const canEdit = isEditing && !isLocked
    
    switch (block.type) {
      case "grid":
        return <GridBlock block={block} isEditing={canEdit} />

      case "form":
        return (
          <FormBlock
            block={block}
            isEditing={canEdit}
            onSubmit={async (data) => {
              // Handle form submission
              const supabase = await import("@/lib/supabase/client").then((m) => m.createClient())
              const tableId = block.config?.table_id
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
        return <RecordBlock block={block} isEditing={canEdit} />

      case "chart":
        return <ChartBlock block={block} isEditing={canEdit} />

      case "kpi":
        return <KPIBlock block={block} isEditing={canEdit} />

      case "text":
        return <TextBlock block={block} isEditing={canEdit} />

      case "table_snapshot":
        return <TableSnapshotBlock block={block} isEditing={canEdit} />

      case "action":
        return <ActionBlock block={block} isEditing={canEdit} />

      case "link_preview":
        return <LinkPreviewBlock block={block} isEditing={canEdit} />

      case "image":
        return (
          <ImageBlock
            block={block}
            isEditing={canEdit}
            onUpdate={(updates) => handleUpdate(updates)}
          />
        )

      case "divider":
        return <DividerBlock block={block} isEditing={canEdit} />

      case "button":
        return <ButtonBlock block={block} isEditing={canEdit} />

      case "tabs":
        return (
          <TabsBlock
            block={block}
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
