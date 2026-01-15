"use client"

import { useState, useCallback, useEffect, useMemo } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useRecordPanel } from "@/contexts/RecordPanelContext"
import { useToast } from "@/components/ui/use-toast"
import InlineFieldEditor from "./InlineFieldEditor"
import type { TableField } from "@/types/fields"

interface RecordFieldsProps {
  fields: TableField[]
  formData: Record<string, any>
  onFieldChange: (fieldName: string, value: any) => void
  fieldGroups: Record<string, string[]>
  tableId: string
  recordId: string
  isFieldEditable?: (fieldName: string) => boolean // Function to check if a field is editable
  tableName?: string // Supabase table name (optional, will be fetched if not provided)
}

const DEFAULT_GROUP_NAME = "General"

// Get localStorage key for collapsed groups state
const getCollapsedGroupsKey = (tableId: string) => `record-view-collapsed-groups-${tableId}`

export default function RecordFields({
  fields,
  formData,
  onFieldChange,
  fieldGroups,
  tableId,
  recordId,
  isFieldEditable = () => true, // Default to all fields editable if not provided
  tableName: propTableName,
}: RecordFieldsProps) {
  const { navigateToLinkedRecord } = useRecordPanel()
  const { toast } = useToast()
  const [editingField, setEditingField] = useState<string | null>(null)
  const [tableName, setTableName] = useState<string | undefined>(propTableName)
  const supabase = createClient()

  // Load collapsed groups state from localStorage
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set()
    try {
      const stored = localStorage.getItem(getCollapsedGroupsKey(tableId))
      if (stored) {
        return new Set(JSON.parse(stored))
      }
    } catch (error) {
      console.warn("Failed to load collapsed groups from localStorage:", error)
    }
    return new Set()
  })

  // Persist collapsed groups state to localStorage
  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      localStorage.setItem(
        getCollapsedGroupsKey(tableId),
        JSON.stringify(Array.from(collapsedGroups))
      )
    } catch (error) {
      console.warn("Failed to save collapsed groups to localStorage:", error)
    }
  }, [collapsedGroups, tableId])

  // Fetch table name if not provided
  useEffect(() => {
    if (!tableName && tableId) {
      supabase
        .from("tables")
        .select("supabase_table")
        .eq("id", tableId)
        .single()
        .then(({ data, error }) => {
          if (!error && data) {
            setTableName(data.supabase_table)
          }
        })
    }
  }, [tableId, tableName, supabase])

  // Group and sort fields based on metadata
  const groupedFields = useMemo(() => {
    // Build field-to-group mapping from fieldGroups prop (legacy support)
    const fieldToGroupMap: Record<string, string> = {}
    Object.entries(fieldGroups).forEach(([groupName, fieldNames]) => {
      fieldNames.forEach((fieldName) => {
        fieldToGroupMap[fieldName] = groupName
      })
    })

    // Group all fields - use field.group_name as primary source, fallback to fieldGroups prop
    const groups: Record<string, TableField[]> = {}

    fields.forEach((field) => {
      // Priority: field.group_name > fieldGroups prop > DEFAULT_GROUP_NAME
      const groupName = field.group_name || fieldToGroupMap[field.name] || DEFAULT_GROUP_NAME

      if (!groups[groupName]) {
        groups[groupName] = []
      }
      groups[groupName].push(field)
    })

    // Sort fields within each group by order_index (fallback to position)
    Object.keys(groups).forEach((groupName) => {
      groups[groupName].sort((a, b) => {
        const orderA = a.order_index ?? a.position ?? 0
        const orderB = b.order_index ?? b.position ?? 0
        return orderA - orderB
      })
    })

    // Sort groups by minimum order_index of fields in each group
    // "General" group always appears first if it exists
    const sortedGroupEntries = Object.entries(groups).sort(([nameA, fieldsA], [nameB, fieldsB]) => {
      // "General" group always first
      if (nameA === DEFAULT_GROUP_NAME) return -1
      if (nameB === DEFAULT_GROUP_NAME) return 1

      // Otherwise, sort by minimum order_index in each group
      const minOrderA = Math.min(...fieldsA.map((f) => f.order_index ?? f.position ?? 0))
      const minOrderB = Math.min(...fieldsB.map((f) => f.order_index ?? f.position ?? 0))
      return minOrderA - minOrderB
    })

    return Object.fromEntries(sortedGroupEntries)
  }, [fields, fieldGroups])

  const toggleGroup = (groupName: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(groupName)) {
        next.delete(groupName)
      } else {
        next.add(groupName)
      }
      return next
    })
  }

  const handleLinkedRecordClick = useCallback(
    async (linkedTableId: string, linkedRecordId: string) => {
      try {
        // If RecordPanel context is available, use it
        if (navigateToLinkedRecord) {
          const supabase = createClient()
          const { data: linkedTable } = await supabase
            .from("tables")
            .select("name, supabase_table")
            .eq("id", linkedTableId)
            .single()

          if (linkedTable) {
            navigateToLinkedRecord(linkedTableId, linkedRecordId, linkedTable.supabase_table)
            return
          }
        }
        
        // Otherwise, navigate to record page
        window.location.href = `/tables/${linkedTableId}/records/${linkedRecordId}`
      } catch (error: any) {
        console.error("Error navigating to linked record:", error)
        toast({
          title: "Failed to open linked record",
          description: error.message || "Please try again",
          variant: "destructive",
        })
      }
    },
    [navigateToLinkedRecord, toast]
  )

  const handleAddLinkedRecord = useCallback(
    async (field: TableField) => {
      const linkedTableId = field.options?.linked_table_id
      if (!linkedTableId) return

      // For now, show a toast - in future, open a modal to select/create record
      toast({
        title: "Add linked record",
        description: "This feature will open a record picker.",
      })
    },
    [toast]
  )

  return (
    <div className="space-y-10">
      {/* Render all groups - all fields are grouped (ungrouped go to "General") */}
      {Object.entries(groupedFields)
        .filter(([_, groupFields]) => groupFields.length > 0) // Hide empty groups
        .map(([groupName, groupFields]) => {
          const isCollapsed = collapsedGroups.has(groupName)
          return (
            <section key={groupName} className="space-y-3">
              <button
                onClick={() => toggleGroup(groupName)}
                className="w-full flex items-center justify-between text-left"
                aria-expanded={!isCollapsed}
                aria-label={`${isCollapsed ? "Expand" : "Collapse"} ${groupName} group`}
              >
                <span className="text-sm font-semibold text-gray-900">{groupName}</span>
                <span className="text-gray-400">
                  {isCollapsed ? (
                    <ChevronRight className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </span>
              </button>
              {!isCollapsed && (
                <div className="space-y-3">
                  {groupFields.map((field) => {
                    const fieldEditable = isFieldEditable(field.name)
                    const isThisEditing = editingField === field.id
                    return (
                      <div
                        key={field.id}
                        className="grid grid-cols-[180px_minmax(0,1fr)] gap-x-8 items-start"
                      >
                        <div className="pt-2 text-xs font-medium text-gray-500">
                          {field.name}
                        </div>
                        <div className="min-w-0">
                          <InlineFieldEditor
                            field={field}
                            value={formData[field.name]}
                            onChange={(value) => onFieldChange(field.name, value)}
                            isEditing={isThisEditing}
                            onEditStart={() => {
                              if (!fieldEditable) return
                              setEditingField(field.id)
                            }}
                            onEditEnd={() => {
                              setEditingField((prev) => (prev === field.id ? null : prev))
                            }}
                            onLinkedRecordClick={handleLinkedRecordClick}
                            onAddLinkedRecord={handleAddLinkedRecord}
                            isReadOnly={!fieldEditable}
                            showLabel={false}
                            tableId={tableId}
                            recordId={recordId}
                            tableName={tableName}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>
          )
        })}

      {/* Empty State */}
      {fields.length === 0 && (
        <div className="text-center py-12 text-gray-400 text-sm">
          No fields available
        </div>
      )}
    </div>
  )
}

