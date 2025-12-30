"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { ChevronDown, ChevronRight, Link2, Plus, X } from "lucide-react"
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
}

export default function RecordFields({
  fields,
  formData,
  onFieldChange,
  fieldGroups,
  tableId,
  recordId,
}: RecordFieldsProps) {
  const { navigateToLinkedRecord } = useRecordPanel()
  const { toast } = useToast()
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [editingField, setEditingField] = useState<string | null>(null)

  // Group fields
  // fieldGroups maps groupName -> fieldNames[]
  // We need to reverse this to map fieldName -> groupName
  const fieldToGroupMap: Record<string, string> = {}
  Object.entries(fieldGroups).forEach(([groupName, fieldNames]) => {
    fieldNames.forEach((fieldName) => {
      fieldToGroupMap[fieldName] = groupName
    })
  })

  const groupedFields: Record<string, TableField[]> = {}
  const ungroupedFields: TableField[] = []

  fields.forEach((field) => {
    const groupName = fieldToGroupMap[field.name] || field.group_name || null
    if (groupName) {
      if (!groupedFields[groupName]) {
        groupedFields[groupName] = []
      }
      groupedFields[groupName].push(field)
    } else {
      ungroupedFields.push(field)
    }
  })

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
    <div className="space-y-6">
      {/* Grouped Fields */}
      {Object.entries(groupedFields).map(([groupName, groupFields]) => {
        const isCollapsed = collapsedGroups.has(groupName)
        return (
          <div key={groupName} className="border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => toggleGroup(groupName)}
              className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors flex items-center justify-between"
            >
              <span className="font-semibold text-sm text-gray-900">{groupName}</span>
              {isCollapsed ? (
                <ChevronRight className="h-4 w-4 text-gray-500" />
              ) : (
                <ChevronDown className="h-4 w-4 text-gray-500" />
              )}
            </button>
            {!isCollapsed && (
              <div className="p-4 space-y-4">
                {groupFields.map((field) => (
                  <InlineFieldEditor
                    key={field.id}
                    field={field}
                    value={formData[field.name]}
                    onChange={(value) => onFieldChange(field.name, value)}
                    isEditing={editingField === field.id}
                    onEditStart={() => setEditingField(field.id)}
                    onEditEnd={() => setEditingField(null)}
                    onLinkedRecordClick={handleLinkedRecordClick}
                    onAddLinkedRecord={handleAddLinkedRecord}
                  />
                ))}
              </div>
            )}
          </div>
        )
      })}

      {/* Ungrouped Fields */}
      {ungroupedFields.length > 0 && (
        <div className="space-y-4">
          {ungroupedFields.map((field) => (
            <InlineFieldEditor
              key={field.id}
              field={field}
              value={formData[field.name]}
              onChange={(value) => onFieldChange(field.name, value)}
              isEditing={editingField === field.id}
              onEditStart={() => setEditingField(field.id)}
              onEditEnd={() => setEditingField(null)}
              onLinkedRecordClick={handleLinkedRecordClick}
              onAddLinkedRecord={handleAddLinkedRecord}
            />
          ))}
        </div>
      )}

      {/* Empty State */}
      {fields.length === 0 && (
        <div className="text-center py-8 text-gray-400 text-sm">
          No fields available
        </div>
      )}
    </div>
  )
}

