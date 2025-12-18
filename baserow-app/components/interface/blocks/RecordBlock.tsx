"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { PageBlock } from "@/lib/interface/types"
import type { TableField } from "@/types/database"

interface RecordBlockProps {
  block: PageBlock
  isEditing?: boolean
}

export default function RecordBlock({ block, isEditing = false }: RecordBlockProps) {
  const { config } = block
  const tableId = config?.table_id
  const recordId = config?.record_id
  const [record, setRecord] = useState<any>(null)
  const [fields, setFields] = useState<TableField[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (tableId && recordId) {
      loadRecord()
    }
    if (tableId) {
      loadFields()
    }
  }, [tableId, recordId])

  async function loadRecord() {
    if (!tableId || !recordId) return

    setLoading(true)
    const supabase = createClient()

    // Get table name
    const { data: table } = await supabase
      .from("tables")
      .select("supabase_table")
      .eq("id", tableId)
      .single()

    if (!table?.supabase_table) {
      setLoading(false)
      return
    }

    // Load record
    const { data } = await supabase
      .from(table.supabase_table)
      .select("*")
      .eq("id", recordId)
      .single()

    setRecord(data)
    setLoading(false)
  }

  async function loadFields() {
    if (!tableId) return

    const supabase = createClient()
    const { data } = await supabase
      .from("table_fields")
      .select("*")
      .eq("table_id", tableId)
      .order("position", { ascending: true })

    setFields((data || []) as TableField[])
  }

  if (!tableId || !recordId) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 text-sm">
        {isEditing ? "Select a table and record" : "No record selected"}
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

  if (!record) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 text-sm">
        Record not found
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto p-4">
      <div className="space-y-4">
        {fields.map((field) => {
          const value = record[field.name]
          return (
            <div key={field.id} className="border-b border-gray-200 pb-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {field.name}
              </label>
              <div className="text-sm text-gray-900">
                {value !== null && value !== undefined ? String(value) : <span className="text-gray-400">—</span>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
