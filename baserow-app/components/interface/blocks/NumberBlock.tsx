"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import type { PageBlock } from "@/lib/interface/types"
import type { TableField } from "@/types/fields"

interface NumberBlockProps {
  block: PageBlock
  isEditing?: boolean
  pageTableId?: string | null
  recordId?: string | null
}

/**
 * NumberBlock - Displays a single number field value
 * Similar to FieldBlock but focused on numeric display
 */
export default function NumberBlock({ block, isEditing = false, pageTableId = null, recordId = null }: NumberBlockProps) {
  const { config } = block
  const fieldId = config?.field_id
  const tableId = config?.table_id || pageTableId
  const [field, setField] = useState<TableField | null>(null)
  const [fieldValue, setFieldValue] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [tableName, setTableName] = useState<string | null>(null)

  // Load field info
  useEffect(() => {
    if (tableId && fieldId) {
      loadFieldInfo()
    }
  }, [tableId, fieldId])

  // Load field value when recordId changes
  useEffect(() => {
    if (recordId && tableName && field) {
      loadFieldValue()
    } else {
      setFieldValue(null)
    }
  }, [recordId, tableName, field])

  async function loadFieldInfo() {
    if (!tableId || !fieldId) return

    setLoading(true)
    try {
      const supabase = createClient()
      
      // Load table name
      const { data: table } = await supabase
        .from("tables")
        .select("supabase_table")
        .eq("id", tableId)
        .maybeSingle()

      if (table?.supabase_table) {
        setTableName(table.supabase_table)
      }

      // Load field definition
      const { data: fieldData } = await supabase
        .from("table_fields")
        .select("*")
        .eq("id", fieldId)
        .eq("table_id", tableId)
        .maybeSingle()

      if (fieldData) {
        setField(fieldData as TableField)
      }
    } catch (error) {
      console.error("Error loading field info:", error)
    } finally {
      setLoading(false)
    }
  }

  async function loadFieldValue() {
    if (!recordId || !tableName || !field) return

    setLoading(true)
    try {
      const supabase = createClient()
      const { data } = await supabase
        .from(tableName)
        .select(field.name)
        .eq("id", recordId)
        .maybeSingle()

      if (data) {
        const value = (data as Record<string, any>)[field.name]
        setFieldValue(typeof value === 'number' ? value : (value ? parseFloat(String(value)) : null))
      }
    } catch (error) {
      console.error("Error loading field value:", error)
    } finally {
      setLoading(false)
    }
  }

  // Format number based on field type
  function formatNumber(value: number | null): string {
    if (value === null || value === undefined) return "—"
    
    if (field?.type === 'currency') {
      return new Intl.NumberFormat('en-GB', {
        style: 'currency',
        currency: 'GBP',
      }).format(value)
    }
    
    if (field?.type === 'percent') {
      return `${(value * 100).toFixed(1)}%`
    }
    
    // Default number formatting
    return new Intl.NumberFormat('en-GB').format(value)
  }

  // Show setup state if field or table not configured
  if (!fieldId || !tableId) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 text-sm p-4">
        <div className="text-center">
          <p className="mb-2">{isEditing ? "Number block requires a field configuration." : "No field configured"}</p>
          {isEditing && (
            <p className="text-xs text-gray-400">Configure a number field in block settings.</p>
          )}
        </div>
      </div>
    )
  }

  if (loading && !fieldValue) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 text-sm">
        Loading...
      </div>
    )
  }

  const displayValue = formatNumber(fieldValue)

  return (
    <div className="h-full flex flex-col p-4">
      {field && (
        <div className="text-xs text-gray-500 mb-1">{field.name}</div>
      )}
      <div className="text-2xl font-semibold text-gray-900">
        {displayValue}
      </div>
    </div>
  )
}
