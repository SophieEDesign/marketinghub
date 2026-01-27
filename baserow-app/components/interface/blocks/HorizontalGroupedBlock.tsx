"use client"

import type { PageBlock } from "@/lib/interface/types"
import HorizontalGroupedView from "@/components/views/HorizontalGroupedView"
import type { FilterConfig } from "@/lib/interface/filters"
import type { FilterTree } from "@/lib/filters/canonical-model"
import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import type { TableField } from "@/types/fields"
import type { GroupRule } from "@/lib/grouping/types"

interface HorizontalGroupedBlockProps {
  block: PageBlock
  isEditing?: boolean
  pageTableId?: string | null
  pageId?: string | null
  filters?: FilterConfig[]
  filterTree?: FilterTree
  onRecordClick?: (recordId: string) => void
  pageShowAddRecord?: boolean
  onUpdate?: (blockId: string, config: Partial<PageBlock["config"]>) => void
  isEditingCanvas?: boolean // Whether this block's canvas is being edited
}

/**
 * HorizontalGroupedBlock - Displays records grouped by a field in horizontal tabs
 * Each tab shows records from that group in a card format
 */
export default function HorizontalGroupedBlock({
  block,
  isEditing = false,
  pageTableId = null,
  pageId = null,
  filters = [],
  filterTree = null,
  onRecordClick,
  pageShowAddRecord = false,
  onUpdate,
}: HorizontalGroupedBlockProps) {
  const [tableFields, setTableFields] = useState<TableField[]>([])
  const [tableName, setTableName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const tableId = block.config?.table_id || pageTableId
  const groupBy = block.config?.group_by_field
  const groupByRules = block.config?.group_by_rules as GroupRule[] | undefined
  const recordFields = (block.config?.record_fields as Array<{ field: string; editable?: boolean; order?: number }>) || []
  const storedLayout = (block.config?.record_field_layout as PageBlock[]) || null

  // Handle layout updates from HorizontalGroupedView
  const handleLayoutUpdate = useCallback(async (blocks: PageBlock[]) => {
    if (!onUpdate) return
    
    // Save layout to block config
    await onUpdate(block.id, {
      record_field_layout: blocks,
    })
  }, [block.id, onUpdate])

  // Load table info and fields
  useEffect(() => {
    if (!tableId) {
      setLoading(false)
      return
    }

    async function loadTableInfo() {
      try {
        const supabase = createClient()
        
        // Load table name
        const { data: tableData } = await supabase
          .from("tables")
          .select("supabase_table")
          .eq("id", tableId)
          .single()

        if (tableData) {
          setTableName(tableData.supabase_table)
        }

        // Load fields
        const response = await fetch(`/api/tables/${tableId}/fields`)
        const data = await response.json()
        if (data.fields) {
          setTableFields(data.fields)
        }
      } catch (error) {
        console.error("Error loading table info:", error)
      } finally {
        setLoading(false)
      }
    }

    loadTableInfo()
  }, [tableId])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[200px]">
        <div className="text-sm text-muted-foreground">Loading...</div>
      </div>
    )
  }

  if (!tableId || !tableName) {
    return (
      <div className="flex items-center justify-center h-full min-h-[200px] p-4">
        <div className="text-sm text-muted-foreground text-center">
          {isEditing ? "Please configure a table in block settings" : "No table configured"}
        </div>
      </div>
    )
  }

  // Merge block-level filters with page-level filters
  // Block-level filters come from block.config.filters
  // Page-level filters come from Filter blocks via filters prop
  const blockFilters = (block.config?.filters as FilterConfig[]) || []
  const pageFilters = filters || []
  
  // Combine: page filters first (from Filter blocks), then block filters
  const effectiveFilters = [...pageFilters, ...blockFilters]

  // Get sorts from block config and convert BlockSort[] to expected format
  const blockSorts = (block.config?.sorts as Array<{ field: string; direction: 'asc' | 'desc' }>) || []
  const sorts = blockSorts.map(sort => ({
    field_name: sort.field,
    direction: sort.direction
  }))

  return (
    <div className="h-full w-full">
      <HorizontalGroupedView
        tableId={tableId}
        viewId={pageId || block.id}
        supabaseTableName={tableName}
        tableFields={tableFields}
        filters={effectiveFilters}
        sorts={sorts}
        groupBy={groupBy}
        groupByRules={groupByRules}
        onRecordClick={onRecordClick}
        recordFields={recordFields}
        isEditing={isEditingCanvas || isEditing}
        onBlockUpdate={handleLayoutUpdate}
        storedLayout={storedLayout}
      />
    </div>
  )
}
