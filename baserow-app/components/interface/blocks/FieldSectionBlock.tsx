"use client"

import { useState, useEffect, useMemo } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import type { PageBlock } from "@/lib/interface/types"
import type { TableField } from "@/types/fields"
import InlineFieldEditor from "@/components/records/InlineFieldEditor"
import { sectionAndSortFields } from "@/lib/fields/sectioning"
import { resolveSystemFieldAlias } from "@/lib/fields/systemFieldAliases"
import { useToast } from "@/components/ui/use-toast"

interface FieldSectionBlockProps {
  block: PageBlock
  isEditing?: boolean
  pageTableId?: string | null
  recordId?: string | null // Record ID from page context (required for field section blocks)
  hideEditButton?: boolean // Hide Edit button for top fields (inline editing only)
}

/**
 * FieldSectionBlock - Displays multiple fields from a section (group_name)
 * 
 * REQUIREMENTS:
 * - Must receive recordId from page context (Record Review pages)
 * - Displays all fields from the specified section
 * - Shows setup state if section name or recordId missing
 * - Supports inline editing like individual field blocks
 * - Can be collapsed/expanded
 */
export default function FieldSectionBlock({ 
  block, 
  isEditing = false, 
  pageTableId = null,
  recordId = null,
  hideEditButton = false
}: FieldSectionBlockProps) {
  const { config } = block
  const sectionName = config?.group_name as string | undefined
  const fieldNames = config?.field_names as string[] | undefined // Optional: filter specific fields
  const defaultCollapsed = config?.collapsed ?? false
  const showLabels = config?.show_labels !== false // Default to true
  
  const [fields, setFields] = useState<TableField[]>([])
  const [fieldValues, setFieldValues] = useState<Record<string, any>>({})
  const [editingField, setEditingField] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [tableName, setTableName] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState(defaultCollapsed)
  const { toast } = useToast()

  // Load table name and fields
  useEffect(() => {
    if (pageTableId && sectionName) {
      loadFields()
    }
  }, [pageTableId, sectionName, fieldNames])

  // Load record values when recordId changes
  useEffect(() => {
    if (recordId && tableName && fields.length > 0) {
      loadFieldValues()
    } else {
      setFieldValues({})
    }
  }, [recordId, tableName, fields])

  async function loadFields() {
    if (!pageTableId || !sectionName) return

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

      // Load all fields from the table
      const { data: allFields } = await supabase
        .from("table_fields")
        .select("*")
        .eq("table_id", pageTableId)
        .order("order_index", { ascending: true, nullsFirst: false })
        .order("position", { ascending: true })

      if (allFields) {
        // Filter to fields in this section
        let sectionFields = (allFields as TableField[]).filter(
          (f) => (f.group_name || "General") === sectionName
        )

        // If field_names is specified, further filter
        if (fieldNames && fieldNames.length > 0) {
          sectionFields = sectionFields.filter((f) => fieldNames.includes(f.name))
        }

        setFields(sectionFields)
      }
    } catch (error) {
      console.error("Error loading fields:", error)
    } finally {
      setLoading(false)
    }
  }

  async function loadFieldValues() {
    if (!recordId || !tableName || fields.length === 0) return

    setLoading(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from(tableName)
        .select("*")
        .eq("id", recordId)
        .single()

      if (error) throw error
      if (data) {
        const row = data as Record<string, any>
        const values: Record<string, any> = {}
        
        fields.forEach((field) => {
          const alias = resolveSystemFieldAlias(field.name)
          values[field.id] =
            row[field.name] ??
            (alias ? row[alias] : undefined) ??
            null
        })
        
        setFieldValues(values)
      }
    } catch (error) {
      console.error("Error loading field values:", error)
      setFieldValues({})
    } finally {
      setLoading(false)
    }
  }

  async function handleCommit(fieldId: string, newValue: any) {
    if (!recordId || !tableName) {
      setEditingField(null)
      return
    }

    const field = fields.find((f) => f.id === fieldId)
    if (!field) {
      setEditingField(null)
      return
    }

    // Guard: system/virtual fields are read-only
    if (field.options?.system || field.type === "formula" || field.type === "lookup") {
      setEditingField(null)
      toast({
        variant: "destructive",
        title: "Read-only field",
        description: "This field cannot be edited here.",
      })
      return
    }

    // No-op if unchanged
    if (newValue === fieldValues[fieldId]) {
      setEditingField(null)
      return
    }

    try {
      const supabase = createClient()
      const { error } = await supabase
        .from(tableName)
        .update({ [field.name]: newValue })
        .eq("id", recordId)

      if (error) throw error

      setFieldValues((prev) => ({ ...prev, [fieldId]: newValue }))
    } catch (error: any) {
      console.error("Error updating field value:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update field",
      })
    } finally {
      setEditingField(null)
    }
  }

  // Setup state: Missing section name
  if (!sectionName) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 text-sm p-4">
        <div className="text-center">
          <p className="mb-2">{isEditing ? "This block requires a section name." : "No section configured"}</p>
          {isEditing && (
            <p className="text-xs text-gray-400">Configure the section in block settings.</p>
          )}
        </div>
      </div>
    )
  }

  // Setup state: Missing recordId
  if (!recordId) {
    if (isEditing && fields.length > 0) {
      // Show section preview in edit mode
      return (
        <div className="h-full flex flex-col p-4">
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-semibold text-gray-700">
              {sectionName}
            </label>
            <button
              type="button"
              onClick={() => setCollapsed(!collapsed)}
              className="text-gray-400 hover:text-gray-600"
            >
              {collapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
          </div>
          {!collapsed && (
            <div className="space-y-2 text-sm text-gray-400 italic">
              {fields.map((field) => (
                <div key={field.id} className="border border-dashed border-gray-300 rounded p-2">
                  {field.name}
                </div>
              ))}
            </div>
          )}
        </div>
      )
    }
    
    return (
      <div className="h-full flex items-center justify-center text-gray-400 text-sm p-4">
        <div className="text-center">
          <p className="mb-2">No record selected</p>
          <p className="text-xs text-gray-400">Select a record to see field values</p>
        </div>
      </div>
    )
  }

  // Loading state
  if (loading || fields.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 text-sm p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-400 mx-auto mb-2" />
          <p className="text-xs">Loading fields...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full p-3">
      <div className="space-y-2">
        {/* Section Header */}
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-between text-left py-1 -mx-1 px-1 rounded-md hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30"
          aria-expanded={!collapsed}
          aria-label={`${collapsed ? "Expand" : "Collapse"} ${sectionName} section`}
        >
          <span className="text-sm font-semibold text-gray-900">{sectionName}</span>
          <span className="text-gray-400">
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </span>
        </button>

        {/* Section Fields */}
        {!collapsed && (
          <div className="space-y-3 pl-2">
            {fields.map((field) => {
              const value = fieldValues[field.id]
              const isThisEditing = editingField === field.id
              const isEditable = !field.options?.system && field.type !== "formula" && field.type !== "lookup"

              return (
                <div
                  key={field.id}
                  className={cn(
                    "grid gap-x-4 gap-y-1 items-start",
                    showLabels ? "grid-cols-1 sm:grid-cols-[140px_minmax(0,1fr)]" : "grid-cols-1"
                  )}
                >
                  {showLabels && (
                    <div className="text-xs font-medium text-gray-500 leading-5 sm:pt-1.5">
                      {field.name}
                      {field.required && <span className="text-red-500 ml-1">*</span>}
                    </div>
                  )}
                  <div className="min-w-0">
                    <InlineFieldEditor
                      field={field}
                      value={value}
                      onChange={(newValue) => handleCommit(field.id, newValue)}
                      isEditing={isThisEditing}
                      onEditStart={() => {
                        if (!isEditable) return
                        setEditingField(field.id)
                      }}
                      onEditEnd={() => {
                        setEditingField((prev) => (prev === field.id ? null : prev))
                      }}
                      onLinkedRecordClick={(linkedTableId, linkedRecordId) => {
                        // Never open the current record (self-link edge case)
                        if (pageTableId && recordId && linkedTableId === pageTableId && linkedRecordId === recordId) {
                          return
                        }
                        window.location.href = `/tables/${linkedTableId}/records/${linkedRecordId}`
                      }}
                      onAddLinkedRecord={() => {
                        toast({
                          title: "Not implemented",
                          description: "Adding linked records is not available here yet.",
                        })
                      }}
                      isReadOnly={!isEditable}
                      showLabel={false}
                      tableId={pageTableId || undefined}
                      recordId={recordId || undefined}
                      tableName={tableName || undefined}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
