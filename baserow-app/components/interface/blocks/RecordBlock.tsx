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
  // Use page's tableId and recordId if block doesn't have them configured
  const tableId = config?.table_id || pageTableId
  const recordId = config?.record_id || pageRecordId
  const { openRecord } = useRecordPanel()
  const [tableName, setTableName] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (tableId) {
      loadTableName()
    }
    // Open record panel when recordId is set
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
          <p className="mb-2">{isEditing ? "This block isn't connected to a table yet." : "No table connection"}</p>
          {isEditing && (
            <p className="text-xs text-gray-400">Configure the table in block settings, or ensure the page has a table connection.</p>
          )}
        </div>
      </div>
    )
  }
  
  if (!recordId) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 text-sm p-4">
        <div className="text-center">
          <p className="mb-2">{isEditing ? "No record selected" : "No record selected"}</p>
          {isEditing && (
            <p className="text-xs text-gray-400">Select a record in Record Review, or configure a record ID in block settings.</p>
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
