"use client"

import type { ViewBlock } from "@/types/database"

interface EmbedBlockProps {
  block: ViewBlock
}

export default function EmbedBlock({ block }: EmbedBlockProps) {
  const url = block.config?.url || ""

  if (!url) {
    return <div className="text-muted-foreground">No embed URL provided</div>
  }

  return (
    <div className="w-full h-full">
      <iframe
        src={url}
        className="w-full h-full border-0"
        allowFullScreen
        title="Embedded content"
      />
    </div>
  )
}
