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

interface BlockRendererProps {
  block: PageBlock
  isEditing?: boolean
  onUpdate?: (blockId: string, config: Partial<PageBlock["config"]>) => void
}

export default function BlockRenderer({
  block,
  isEditing = false,
  onUpdate,
}: BlockRendererProps) {
  const handleUpdate = (updates: Partial<PageBlock["config"]>) => {
    if (onUpdate) {
      onUpdate(block.id, updates)
    }
  }

  switch (block.type) {
    case "grid":
      return <GridBlock block={block} isEditing={isEditing} />

    case "form":
      return (
        <FormBlock
          block={block}
          isEditing={isEditing}
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
      return <RecordBlock block={block} isEditing={isEditing} />

    case "chart":
      return <ChartBlock block={block} isEditing={isEditing} />

    case "kpi":
      return <KPIBlock block={block} isEditing={isEditing} />

    case "text":
      return (
        <TextBlock
          block={block}
          isEditing={isEditing}
          onUpdate={(content) => handleUpdate({ text_content: content })}
        />
      )

    case "image":
      return (
        <ImageBlock
          block={block}
          isEditing={isEditing}
          onUpdate={(url, alt) => handleUpdate({ image_url: url, image_alt: alt })}
        />
      )

    case "divider":
      return <DividerBlock block={block} isEditing={isEditing} />

    case "button":
      return <ButtonBlock block={block} isEditing={isEditing} />

    default:
      return (
        <div className="h-full flex items-center justify-center text-gray-400">
          Unknown block type: {block.type}
        </div>
      )
  }
}
