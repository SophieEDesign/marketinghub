"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import type { PageBlock } from "@/lib/interface/types"
import type { TableField } from "@/types/fields"
import { cn } from "@/lib/utils"

interface FieldBlockProps {
  block: PageBlock
  isEditing?: boolean
  pageTableId?: string | null
  recordId?: string | null // Record ID from page context (required for field blocks)
}

/**
 * FieldBlock - Displays a field label + value from a record
 * 
 * REQUIREMENTS:
 * - Must receive recordId from page context (Record Review pages)
 * - Displays field label + formatted value
 * - Shows setup state if field_id or recordId missing
 * - No editing capability (fields are edited via grid/form)
 */
export default function FieldBlock({ 
  block, 
  isEditing = false, 
  pageTableId = null,
  recordId = null 
}: FieldBlockProps) {
  const { config } = block
  const fieldId = config?.field_id
  const [field, setField] = useState<TableField | null>(null)
  const [fieldValue, setFieldValue] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [tableName, setTableName] = useState<string | null>(null)

  // Load table name and field info
  useEffect(() => {
    if (pageTableId && fieldId) {
      loadFieldInfo()
    }
  }, [pageTableId, fieldId])

  // Load record value when recordId changes
  useEffect(() => {
    if (recordId && tableName && field) {
      loadFieldValue()
    } else {
      setFieldValue(null)
    }
  }, [recordId, tableName, field])

  async function loadFieldInfo() {
    if (!pageTableId || !fieldId) return

    setLoading(true)
    try {
      const supabase = createClient()
      
      // Load table name
      const { data: table } = await supabase
        .from("tables")
        .select("supabase_table")
        .eq("id", pageTableId)
        .single()

      if (table?.supabase_table) {
        setTableName(table.supabase_table)
      }

      // Load field definition
      const { data: fieldData } = await supabase
        .from("table_fields")
        .select("*")
        .eq("id", fieldId)
        .eq("table_id", pageTableId)
        .single()

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
      const { data, error } = await supabase
        .from(tableName)
        .select(field.name)
        .eq("id", recordId)
        .single()

      if (error) throw error
      if (data) {
        setFieldValue(data[field.name])
      }
    } catch (error) {
      console.error("Error loading field value:", error)
      setFieldValue(null)
    } finally {
      setLoading(false)
    }
  }

  // Setup state: Missing field_id
  if (!fieldId) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 text-sm p-4">
        <div className="text-center">
          <p className="mb-2">{isEditing ? "This block requires a field." : "No field configured"}</p>
          {isEditing && (
            <p className="text-xs text-gray-400">Configure the field in block settings.</p>
          )}
        </div>
      </div>
    )
  }

  // Setup state: Missing recordId
  if (!recordId) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 text-sm p-4">
        <div className="text-center">
          <p className="mb-2">No record selected</p>
          <p className="text-xs text-gray-400">Select a record to see field value</p>
        </div>
      </div>
    )
  }

  // Loading state
  if (loading || !field) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 text-sm p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-400 mx-auto mb-2" />
          <p className="text-xs">Loading field...</p>
        </div>
      </div>
    )
  }

  // Format field value based on type
  const formatValue = (value: any, fieldType: string, options?: any): string => {
    if (value === null || value === undefined) return "—"

    switch (fieldType) {
      case 'checkbox':
        return value ? '✓' : '✗'
      case 'date':
        if (!value) return "—"
        try {
          const date = new Date(value)
          return date.toLocaleDateString()
        } catch {
          return String(value)
        }
      case 'currency':
        const currencySymbol = options?.currency_symbol || '$'
        const precision = options?.precision ?? 2
        return `${currencySymbol}${Number(value).toFixed(precision)}`
      case 'percent':
        const percentPrecision = options?.precision ?? 2
        return `${Number(value).toFixed(percentPrecision)}%`
      case 'number':
        const numPrecision = options?.precision ?? 2
        return Number(value).toFixed(numPrecision)
      case 'single_select':
      case 'multi_select':
        if (Array.isArray(value)) {
          return value.join(', ')
        }
        return String(value)
      case 'link_to_table':
        // For linked records, show count or ID
        if (Array.isArray(value)) {
          return `${value.length} linked record${value.length !== 1 ? 's' : ''}`
        }
        return value ? 'Linked' : '—'
      default:
        return String(value)
    }
  }

  const displayValue = formatValue(fieldValue, field.type, field.options)

  return (
    <div className="h-full flex flex-col p-4">
      {/* Field Label */}
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {field.name}
        {field.required && <span className="text-red-500 ml-1">*</span>}
      </label>
      
      {/* Field Value */}
      <div className={cn(
        "flex-1 text-sm text-gray-900",
        field.type === 'long_text' && "whitespace-pre-wrap",
        field.type === 'checkbox' && "text-lg"
      )}>
        {displayValue}
      </div>
    </div>
  )
}

