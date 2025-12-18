"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { PageBlock } from "@/lib/interface/types"
import GridView from "@/components/grid/GridView"
import GridViewWrapper from "@/components/grid/GridViewWrapper"

interface GridBlockProps {
  block: PageBlock
  isEditing?: boolean
}

export default function GridBlock({ block, isEditing = false }: GridBlockProps) {
  const { config } = block
  const tableId = config?.table_id
  const viewId = config?.view_id

  if (!tableId) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 text-sm">
        {isEditing ? "Select a table to display" : "No table selected"}
      </div>
    )
  }

  if (!viewId) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 text-sm">
        {isEditing ? "Select a view to display" : "No view selected"}
      </div>
    )
  }

  return (
    <div className="h-full w-full overflow-auto">
      <GridViewWrapper
        tableId={tableId}
        viewId={viewId}
        readOnly={!isEditing}
      />
    </div>
  )
}
