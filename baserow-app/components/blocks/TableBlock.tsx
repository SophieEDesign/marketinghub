"use client"

import type { ViewBlock } from "@/types/database"

interface TableBlockProps {
  block: ViewBlock
}

export default function TableBlock({ block }: TableBlockProps) {
  const tableId = block.config?.tableId || ""

  return (
    <div className="w-full h-full">
      <div className="text-sm text-muted-foreground mb-2">Table Block</div>
      <div className="bg-muted rounded p-4">
        Table view will be embedded here (Table ID: {tableId || "Not configured"})
      </div>
    </div>
  )
}
