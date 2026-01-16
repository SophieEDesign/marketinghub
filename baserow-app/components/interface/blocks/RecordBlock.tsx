"use client"

import { useEffect, useState, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import type { PageBlock } from "@/lib/interface/types"
import type { TableField } from "@/types/database"
import { canOpenRecords } from "@/lib/interface/block-permissions"
import RecordFieldPanel from "@/components/records/RecordFieldPanel"

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
  const [tableName, setTableName] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [tableFields, setTableFields] = useState<TableField[]>([])
  
  // Track previous tableId to prevent unnecessary reloads when config reference changes
  // but tableId value remains the same
  const prevTableIdRef = useRef<string | null>(null)
  const loadingRef = useRef(false)
  
  // Defensive logging for Record Review pages
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[RecordBlock] recordId resolution:', {
        blockId: block.id,
        configRecordId: config?.record_id,
        pageRecordId,
        resolvedRecordId: recordId,
        tableId,
      })
    }
  }, [block.id, config?.record_id, pageRecordId, recordId, tableId])

  useEffect(() => {
    if (!tableId) {
      prevTableIdRef.current = null
      setTableFields([])
      return
    }

    // CRITICAL: Skip reload if tableId hasn't actually changed
    // This prevents unnecessary reloads when config reference changes but value is the same
    if (prevTableIdRef.current === tableId) {
      // If tableId is same but isEditing changed to true and we don't have fields, reload for preview
      if (isEditing && tableFields.length === 0 && !loadingRef.current) {
        loadTableName()
      }
      return
    }

    // Skip if already loading the same table
    if (loadingRef.current && prevTableIdRef.current === tableId) {
      return
    }

    prevTableIdRef.current = tableId
    loadTableName()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableId, isEditing])

  // Check permissions
  const canOpen = canOpenRecords(config)

  async function loadTableName() {
    if (!tableId) return

    loadingRef.current = true
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

      // Load table fields for record view + edit preview
      const { data: fields } = await supabase
        .from("table_fields")
        .select("*")
        .eq("table_id", tableId)
        .order("position", { ascending: true })

      if (fields) {
        setTableFields(fields as TableField[])
      }
    } catch (error) {
      console.error("Error loading table:", error)
      // CRITICAL: Do NOT retry automatically on network failure
      // Keep existing data if available
    } finally {
      setLoading(false)
      loadingRef.current = false
    }
  }

  // Always render something - never return null
  // For Record Review pages, show setup state if tableId or recordId is missing
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
  
  // For Record Review pages: if recordId is missing, show setup state (not blank)
  // In edit mode, show field preview if table is configured
  if (!recordId) {
    if (isEditing && tableFields.length > 0) {
      // Show field preview in edit mode
      return (
        <div className="h-full overflow-auto p-4">
          <div className="space-y-4">
            <div className="text-sm font-medium text-gray-700 mb-2">Record Fields Preview</div>
            {tableFields.map((field) => (
              <div key={field.id} className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">
                  {field.name}
                  {field.type && (
                    <span className="ml-2 text-xs text-gray-400 font-normal">({field.type})</span>
                  )}
                </label>
                <div className="text-sm text-gray-400 italic border border-dashed border-gray-300 rounded p-2 bg-gray-50">
                  Field value will appear here when a record is selected
                </div>
              </div>
            ))}
          </div>
        </div>
      )
    }
    
    return (
      <div className="h-full flex items-center justify-center text-gray-400 text-sm p-4">
        <div className="text-center">
          <p className="mb-2">{isEditing ? "This block requires a record ID." : "Select a record to see details"}</p>
          {isEditing && (
            <p className="text-xs text-gray-400">Configure the record ID in block settings, or select a record from the list.</p>
          )}
          {!isEditing && (
            <p className="text-xs text-gray-400">Click on a record in the list to view its details.</p>
          )}
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400">
        Loading record…
      </div>
    )
  }

  // Check permissions
  if (!canOpen) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 text-sm">
        <div className="text-center">
          <p className="mb-2">Record details access is disabled</p>
          <p className="text-xs text-gray-500">This block does not allow opening record details</p>
        </div>
      </div>
    )
  }

  if (!tableId || !recordId || !tableName) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 text-sm p-4">
        <div className="text-center">
          <p className="mb-2">Record not available</p>
          <p className="text-xs text-gray-500">Please check the table/record configuration.</p>
        </div>
      </div>
    )
  }

  const modalFields = (config as any)?.modal_fields
  const selected = Array.isArray(modalFields) && modalFields.length > 0
    ? modalFields
    : tableFields.map((f: any) => f?.name).filter(Boolean)

  const fieldConfigs = selected.map((f: string, idx: number) => ({
    field: f,
    editable: true,
    order: idx,
  }))

  return (
    <div className="h-full overflow-auto">
      <RecordFieldPanel
        tableId={tableId}
        recordId={String(recordId)}
        fields={fieldConfigs}
        allFields={tableFields as any}
        compact={false}
      />
    </div>
  )
}
