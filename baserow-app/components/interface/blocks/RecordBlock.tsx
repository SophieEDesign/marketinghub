"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRecordPanel } from "@/contexts/RecordPanelContext"
import type { PageBlock } from "@/lib/interface/types"
import type { TableField } from "@/types/database"

interface RecordBlockProps {
  block: PageBlock
  isEditing?: boolean
  pageTableId?: string | null // Table ID from the page
  pageId?: string | null // Page ID
  recordId?: string | null // Record ID for record review pages
}

export default function RecordBlock({ block, isEditing = false, pageTableId = null, pageId = null, recordId: pageRecordId = null }: RecordBlockProps) {
  const { config } = block
  // Record block MUST have table_id configured
  // record_id can come from config OR from page context (for record review pages)
  const tableId = config?.table_id
  // Use config record_id first, fallback to page context recordId prop
  const recordId = config?.record_id || pageRecordId
  const { openRecord } = useRecordPanel()
  const [tableName, setTableName] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (tableId) {
      loadTableName()
    }
  }, [tableId])

  // Open record panel when recordId changes (for record review pages)
  useEffect(() => {
    if (tableId && recordId && tableName) {
      openRecord(tableId, recordId, tableName)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableId, recordId, tableName])

  async function loadTableName() {
    if (!tableId) return

    setLoading(true)
    try {
      const supabase = createClient()
      const { data: table } = await supabase
        .from("tables")
        .select("supabase_table")
        .eq("id", tableId)
        .single()

      if (table?.supabase_table) {
        setTableName(table.supabase_table)
      }
    } catch (error) {
      console.error("Error loading table:", error)
    } finally {
      setLoading(false)
    }
  }

  if (!tableId) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 text-sm p-4">
        <div className="text-center">
          <p className="mb-2">{isEditing ? "This block requires a table connection." : "No table connection"}</p>
          {isEditing && (
            <p className="text-xs text-gray-400">Configure the table in block settings.</p>
          )}
        </div>
      </div>
    )
  }
  
  if (!recordId) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 text-sm p-4">
        <div className="text-center">
          <p className="mb-2">{isEditing ? "This block requires a record ID." : "No record selected"}</p>
          {isEditing && (
            <p className="text-xs text-gray-400">Configure the record ID in block settings.</p>
          )}
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400">
        Loading record...
      </div>
    )
  }

  // Record block now opens the global record panel
  // The panel will handle displaying the record
  return (
    <div className="h-full flex items-center justify-center text-gray-400 text-sm">
      <div className="text-center">
        <p className="mb-2">Record panel opened</p>
        <p className="text-xs text-gray-500">View and edit the record in the side panel</p>
      </div>
    </div>
  )
}
