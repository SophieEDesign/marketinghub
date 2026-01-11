"use client"

/**
 * Field Picker Modal Component
 * 
 * Three-column layout for selecting which fields appear in the Record View:
 * - Left: Field selector with toggles (Connected to: Record list)
 * - Center: Record list preview
 * - Right: Record detail preview showing selected fields
 * 
 * Used in:
 * - Page creation wizard (for record_view pages)
 * - Page Settings (RecordViewPageSettings)
 */

import { useState, useEffect, useMemo, useCallback } from "react"
import { X } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Search } from "lucide-react"
import { getFieldIcon } from "@/lib/icons"
import { createClient } from "@/lib/supabase/client"
import type { TableField } from "@/types/fields"
import { cn } from "@/lib/utils"

interface FieldPickerModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tableId: string | null
  selectedFields: string[] // Field names
  onFieldsChange: (fieldNames: string[]) => void
  onAddAsBlocks?: (fieldNames: string[]) => void // Optional: add selected fields as blocks
}

export default function FieldPickerModal({
  open,
  onOpenChange,
  tableId,
  selectedFields,
  onFieldsChange,
  onAddAsBlocks,
}: FieldPickerModalProps) {
  const [fields, setFields] = useState<TableField[]>([])
  const [tableName, setTableName] = useState<string>("")
  const [records, setRecords] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null)
  const [fieldSearch, setFieldSearch] = useState("")
  const [localSelectedFields, setLocalSelectedFields] = useState<string[]>(selectedFields)

  // Load fields and table name
  useEffect(() => {
    if (open && tableId) {
      loadFields()
      loadTableName()
      loadRecords()
    } else if (!open) {
      // Reset local state when modal closes
      setLocalSelectedFields(selectedFields)
      setFieldSearch("")
      setSelectedRecord(null)
    }
  }, [open, tableId, selectedFields])

  async function loadFields() {
    if (!tableId) return

    setLoading(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("table_fields")
        .select("*")
        .eq("table_id", tableId)
        .order("position", { ascending: true })

      if (error) throw error
      setFields((data || []) as TableField[])
    } catch (error) {
      console.error("Error loading fields:", error)
    } finally {
      setLoading(false)
    }
  }

  async function loadTableName() {
    if (!tableId) return

    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("tables")
        .select("name, supabase_table")
        .eq("id", tableId)
        .single()

      if (error) throw error
      if (data) {
        setTableName(data.name || "")
      }
    } catch (error) {
      console.error("Error loading table name:", error)
    }
  }

  async function loadRecords() {
    if (!tableId) return

    try {
      const supabase = createClient()
      const { data: table } = await supabase
        .from("tables")
        .select("supabase_table")
        .eq("id", tableId)
        .single()

      if (!table?.supabase_table) return

      const { data, error } = await supabase
        .from(table.supabase_table)
        .select("*")
        .limit(10)
        .order("created_at", { ascending: false })

      if (error) throw error
      setRecords(data || [])
      if (data && data.length > 0) {
        setSelectedRecord(data[0])
      }
    } catch (error) {
      console.error("Error loading records:", error)
    }
  }

  // Filter fields by search
  const filteredFields = useMemo(() => {
    if (!fieldSearch) return fields
    const searchLower = fieldSearch.toLowerCase()
    return fields.filter((f) => f.name.toLowerCase().includes(searchLower))
  }, [fields, fieldSearch])

  const handleFieldToggle = (fieldName: string, checked: boolean) => {
    if (checked) {
      setLocalSelectedFields([...localSelectedFields, fieldName])
    } else {
      setLocalSelectedFields(localSelectedFields.filter((f) => f !== fieldName))
    }
  }

  const handleSelectAll = () => {
    setLocalSelectedFields(fields.map((f) => f.name))
  }

  const handleSelectNone = () => {
    setLocalSelectedFields([])
  }

  const handleSave = () => {
    onFieldsChange(localSelectedFields)
    onOpenChange(false)
  }

  const handleAddAsBlocks = () => {
    if (onAddAsBlocks) {
      onAddAsBlocks(localSelectedFields)
    }
    onFieldsChange(localSelectedFields)
    onOpenChange(false)
  }

  // Get visible fields for preview (in order they appear in fields array)
  const visibleFieldsForPreview = useMemo(() => {
    return fields.filter((f) => localSelectedFields.includes(f.name))
  }, [fields, localSelectedFields])

  // Get preview fields for record list (first 3 visible fields)
  const previewFields = useMemo(() => {
    return localSelectedFields.slice(0, 3)
  }, [localSelectedFields])

  if (!tableId) {
    return null
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[1400px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Pick elements</DialogTitle>
          <DialogDescription>
            Display elements and fields on the interface that respond to your selected record. You can always add or remove these later.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 flex gap-4 overflow-hidden mt-4">
          {/* Left: Field Selector */}
          <div className="w-80 border-r flex flex-col overflow-hidden">
            <div className="p-4 border-b">
              <Label className="text-sm font-medium">Connected to: Record list</Label>
              <div className="mt-2 relative">
                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  value={fieldSearch}
                  onChange={(e) => setFieldSearch(e.target.value)}
                  placeholder="Search fields..."
                  className="pl-8 h-8 text-sm"
                />
              </div>
              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-xs text-blue-600 hover:text-blue-700 underline"
                >
                  Select All
                </button>
                <span className="text-xs text-gray-300">|</span>
                <button
                  type="button"
                  onClick={handleSelectNone}
                  className="text-xs text-blue-600 hover:text-blue-700 underline"
                >
                  Select None
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {loading ? (
                <div className="text-sm text-gray-500 text-center py-8">Loading fields...</div>
              ) : filteredFields.length === 0 ? (
                <div className="text-sm text-gray-500 text-center py-8">No fields found</div>
              ) : (
                filteredFields.map((field) => {
                  const isSelected = localSelectedFields.includes(field.name)
                  const FieldIcon = getFieldIcon(field.type)

                  return (
                    <label
                      key={field.id}
                      className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer"
                    >
                      <Switch
                        checked={isSelected}
                        onCheckedChange={(checked) => handleFieldToggle(field.name, checked)}
                      />
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className="flex-shrink-0">{FieldIcon}</div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate">
                            {field.name}
                          </div>
                          <div className="text-xs text-gray-500">{field.type}</div>
                        </div>
                      </div>
                    </label>
                  )
                })
              )}
            </div>
          </div>

          {/* Center: Record List Preview */}
          <div className="w-80 border-r flex flex-col overflow-hidden bg-gray-50">
            <div className="p-4 border-b bg-white">
              <Label className="text-sm font-medium">{tableName || "Record list"}</Label>
            </div>
            <div className="flex-1 overflow-y-auto">
              <div className="p-4 space-y-2">
                {records.length === 0 ? (
                  <div className="text-sm text-gray-500 text-center py-8">No records</div>
                ) : (
                  records.map((record) => {
                    const isSelected = selectedRecord?.id === record.id
                    return (
                      <div
                        key={record.id}
                        onClick={() => setSelectedRecord(record)}
                        className={cn(
                          "p-3 rounded border cursor-pointer transition-colors",
                          isSelected
                            ? "bg-blue-50 border-blue-200"
                            : "bg-white border-gray-200 hover:border-gray-300"
                        )}
                      >
                        {previewFields.length > 0 ? (
                          <div className="space-y-1">
                            {previewFields.map((fieldName, idx) => {
                              const value = record[fieldName]
                              return (
                                <div
                                  key={fieldName}
                                  className={cn(
                                    "text-sm truncate",
                                    idx === 0 ? "font-medium text-gray-900" : "text-gray-600"
                                  )}
                                >
                                  {value !== null && value !== undefined
                                    ? String(value).substring(0, 40)
                                    : "—"}
                                </div>
                              )
                            })}
                          </div>
                        ) : (
                          <div className="text-sm font-medium text-gray-900">
                            {record.id?.substring(0, 8) || "Record"}
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>

          {/* Right: Record Detail Preview */}
          <div className="flex-1 flex flex-col overflow-hidden bg-white border-l">
            <div className="p-4 border-b">
              <Label className="text-sm font-medium">Record details</Label>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {!selectedRecord ? (
                <div className="text-sm text-gray-500 text-center py-8">
                  Select a record from the list to preview
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Record Title */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                      {previewFields.length > 0 && selectedRecord[previewFields[0]]
                        ? String(selectedRecord[previewFields[0]]).substring(0, 50)
                        : selectedRecord.id?.substring(0, 8) || "Untitled"}
                    </h3>
                  </div>

                  {/* Selected Fields List */}
                  {visibleFieldsForPreview.length === 0 ? (
                    <div className="text-sm text-gray-500 text-center py-8">
                      No fields selected. Select fields in the left panel to see them here.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {visibleFieldsForPreview.map((field) => {
                        const value = selectedRecord[field.name]
                        return (
                          <div key={field.id}>
                            <Label className="text-xs font-medium text-gray-500 uppercase">
                              {field.name}
                            </Label>
                            <div className="mt-1 text-sm text-gray-900">
                              {value !== null && value !== undefined ? (
                                field.type === "single_select" && typeof value === "string" ? (
                                  <Badge variant="outline" className="text-xs">
                                    {value}
                                  </Badge>
                                ) : (
                                  String(value)
                                )
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-4 border-t mt-4">
          <div className="text-sm text-gray-500">
            {localSelectedFields.length} of {fields.length} fields selected
          </div>
          <div className="flex gap-2">
            {onAddAsBlocks && (
              <Button
                variant="outline"
                onClick={handleAddAsBlocks}
                disabled={localSelectedFields.length === 0}
              >
                Add as Blocks
              </Button>
            )}
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={loading}>
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
