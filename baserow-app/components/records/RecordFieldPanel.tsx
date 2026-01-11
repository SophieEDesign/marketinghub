"use client"

/**
 * Record Field Panel Component
 * 
 * Displays a structured table-style list of selected fields for a record.
 * This acts as the "source of truth" for core record data.
 * 
 * Features:
 * - Table-style layout (field name | field value)
 * - Inline editing (if permitted)
 * - Configurable field order
 * - Permission-aware (read-only, editable, hidden)
 */

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/components/ui/use-toast"
import InlineFieldEditor from "./InlineFieldEditor"
import type { TableField } from "@/types/fields"

interface FieldConfig {
  field: string // Field name or ID
  editable: boolean
  order?: number
}

interface RecordFieldPanelProps {
  tableId: string
  recordId: string | null
  fields: FieldConfig[] // Selected fields with configuration
  allFields: TableField[] // All available fields from the table
  onFieldChange?: (fieldName: string, value: any) => void
  onLinkedRecordClick?: (tableId: string, recordId: string) => void
  compact?: boolean // Compact display mode
}

export default function RecordFieldPanel({
  tableId,
  recordId,
  fields,
  allFields,
  onFieldChange,
  onLinkedRecordClick,
  compact = false,
}: RecordFieldPanelProps) {
  const { toast } = useToast()
  const [recordData, setRecordData] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(false)
  const [editingField, setEditingField] = useState<string | null>(null)

  // Create a map of field name/id to field config
  const fieldConfigMap = new Map<string, FieldConfig>()
  fields.forEach((config, index) => {
    const key = config.field
    fieldConfigMap.set(key, { ...config, order: config.order ?? index })
  })

  // Get field objects for selected fields, sorted by order
  const selectedFields = allFields
    .filter((field) => fieldConfigMap.has(field.name) || fieldConfigMap.has(field.id))
    .map((field) => {
      const config = fieldConfigMap.get(field.name) || fieldConfigMap.get(field.id)
      return {
        field,
        config: config!,
      }
    })
    .sort((a, b) => (a.config.order ?? 0) - (b.config.order ?? 0))

  // Load record data
  useEffect(() => {
    if (!tableId || !recordId) {
      setRecordData({})
      return
    }

    async function loadRecord() {
      setLoading(true)
      try {
        const supabase = createClient()
        
        // Get table info
        const { data: table } = await supabase
          .from("tables")
          .select("supabase_table")
          .eq("id", tableId)
          .single()

        if (!table) {
          setLoading(false)
          return
        }

        // Load record
        const { data, error } = await supabase
          .from(table.supabase_table)
          .select("*")
          .eq("id", recordId)
          .single()

        if (error) throw error

        setRecordData(data || {})
      } catch (error: any) {
        console.error("Error loading record:", error)
        toast({
          title: "Failed to load record",
          description: error.message || "Please try again",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    loadRecord()
  }, [tableId, recordId, toast])

  // Handle field value change
  const handleFieldChange = useCallback(
    async (fieldName: string, value: any) => {
      if (!recordId || !tableId) return

      try {
        const supabase = createClient()
        
        // Get table info
        const { data: table } = await supabase
          .from("tables")
          .select("supabase_table")
          .eq("id", tableId)
          .single()

        if (!table) return

        // Update record
        const { error } = await supabase
          .from(table.supabase_table)
          .update({ [fieldName]: value })
          .eq("id", recordId)

        if (error) throw error

        // Update local state
        setRecordData((prev) => ({ ...prev, [fieldName]: value }))

        // Notify parent
        onFieldChange?.(fieldName, value)

        toast({
          title: "Field updated",
          description: "The field has been saved successfully.",
        })
      } catch (error: any) {
        console.error("Error updating field:", error)
        toast({
          title: "Failed to update field",
          description: error.message || "Please try again",
          variant: "destructive",
        })
      }
    },
    [recordId, tableId, onFieldChange, toast]
  )

  // Handle linked record click
  const handleLinkedRecordClick = useCallback(
    async (linkedTableId: string, linkedRecordId: string) => {
      if (onLinkedRecordClick) {
        onLinkedRecordClick(linkedTableId, linkedRecordId)
      } else {
        // Default: navigate to record page
        window.location.href = `/tables/${linkedTableId}/records/${linkedRecordId}`
      }
    },
    [onLinkedRecordClick]
  )

  // Handle add linked record (placeholder)
  const handleAddLinkedRecord = useCallback((field: TableField) => {
    toast({
      title: "Add linked record",
      description: "This feature will open a record picker.",
    })
  }, [toast])

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-sm text-gray-500">Loading record data...</div>
      </div>
    )
  }

  if (!recordId) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-sm text-gray-500">No record selected</div>
      </div>
    )
  }

  if (selectedFields.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-sm text-gray-500">No fields configured for this view</div>
      </div>
    )
  }

  return (
    <div className="w-full">
      {compact ? (
        // Compact table view
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full">
            <tbody className="divide-y divide-gray-200">
              {selectedFields.map(({ field, config }) => {
                const value = recordData[field.name]
                const isEditable = config.editable && !field.options?.read_only && field.type !== "formula" && field.type !== "lookup"

                return (
                  <tr key={field.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-50 w-1/3">
                      {field.name}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-900">
                      {isEditable ? (
                        <InlineFieldEditor
                          field={field}
                          value={value}
                          onChange={(newValue) => handleFieldChange(field.name, newValue)}
                          isEditing={editingField === field.id}
                          onEditStart={() => setEditingField(field.id)}
                          onEditEnd={() => setEditingField(null)}
                          onLinkedRecordClick={handleLinkedRecordClick}
                          onAddLinkedRecord={handleAddLinkedRecord}
                        />
                      ) : (
                        <div className="py-1">
                          <InlineFieldEditor
                            field={field}
                            value={value}
                            onChange={() => {}}
                            isEditing={false}
                            onEditStart={() => {}}
                            onEditEnd={() => {}}
                            onLinkedRecordClick={handleLinkedRecordClick}
                            onAddLinkedRecord={handleAddLinkedRecord}
                          />
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        // Standard card view
        <div className="space-y-4">
          {selectedFields.map(({ field, config }) => {
            const value = recordData[field.name]
            const isEditable = config.editable && !field.options?.read_only && field.type !== "formula" && field.type !== "lookup"

            return (
              <div key={field.id} className="border border-gray-200 rounded-lg p-4">
                <div className="text-sm font-medium text-gray-700 mb-2">{field.name}</div>
                <div>
                  {isEditable ? (
                    <InlineFieldEditor
                      field={field}
                      value={value}
                      onChange={(newValue) => handleFieldChange(field.name, newValue)}
                      isEditing={editingField === field.id}
                      onEditStart={() => setEditingField(field.id)}
                      onEditEnd={() => setEditingField(null)}
                      onLinkedRecordClick={handleLinkedRecordClick}
                      onAddLinkedRecord={handleAddLinkedRecord}
                    />
                  ) : (
                    <InlineFieldEditor
                      field={field}
                      value={value}
                      onChange={() => {}}
                      isEditing={false}
                      onEditStart={() => {}}
                      onEditEnd={() => {}}
                      onLinkedRecordClick={handleLinkedRecordClick}
                      onAddLinkedRecord={handleAddLinkedRecord}
                    />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
