"use client"

/**
 * Record View Page Settings Component
 * 
 * Page-level settings for Record View pages:
 * - Source table (page-level)
 * - Title field (page-level)
 * - Visible fields (page-level, with order and editability)
 * - Page permissions (view-only/editable)
 * - Layout toggles (show structured field list, show blocks section)
 * 
 * These settings control the record itself, not how data is displayed in blocks.
 */

import { useState, useEffect, useCallback } from "react"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowUp, ArrowDown, GripVertical, Eye, EyeOff, Edit2, Lock } from "lucide-react"
import type { PageConfig } from "@/lib/interface/page-config"
import type { Table, TableField } from "@/types/database"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

interface RecordViewPageSettingsProps {
  pageId: string
  config: PageConfig
  tables: Table[]
  onUpdate: (updates: Partial<PageConfig>) => Promise<void>
  onTableChange?: (tableId: string) => Promise<void>
}

interface FieldConfig {
  field: string // Field name or ID
  editable: boolean
  visible: boolean
  order: number
}

export default function RecordViewPageSettings({
  pageId,
  config,
  tables,
  onUpdate,
  onTableChange,
}: RecordViewPageSettingsProps) {
  const [selectedTableId, setSelectedTableId] = useState<string>(
    config.table_id || (config as any).base_table || ""
  )
  const [fields, setFields] = useState<TableField[]>([])
  const [loading, setLoading] = useState(false)
  
  // Parse field configurations from config
  const fieldConfigs = useCallback((): FieldConfig[] => {
    const visibleFields = config.visible_fields || config.detail_fields || []
    const editableFields = config.editable_fields || []
    
    // Build map of configured fields
    const fieldMap = new Map<string, FieldConfig>()
    
    visibleFields.forEach((fieldName: string, index: number) => {
      fieldMap.set(fieldName, {
        field: fieldName,
        visible: true,
        editable: editableFields.includes(fieldName),
        order: index,
      })
    })
    
    // Add all other fields as hidden
    fields.forEach((field) => {
      if (!fieldMap.has(field.name)) {
        fieldMap.set(field.name, {
          field: field.name,
          visible: false,
          editable: false,
          order: fields.length + fieldMap.size,
        })
      }
    })
    
    return Array.from(fieldMap.values()).sort((a, b) => a.order - b.order)
  }, [config.visible_fields, config.detail_fields, config.editable_fields, fields])

  const [fieldConfigList, setFieldConfigList] = useState<FieldConfig[]>([])

  // Load fields when table is selected
  useEffect(() => {
    if (selectedTableId) {
      loadFields()
    } else {
      setFields([])
      setFieldConfigList([])
    }
  }, [selectedTableId])

  // Update field config list when fields or config changes
  useEffect(() => {
    if (fields.length > 0) {
      setFieldConfigList(fieldConfigs())
    }
  }, [fields, fieldConfigs])

  async function loadFields() {
    if (!selectedTableId) return
    
    setLoading(true)
    try {
      const supabase = createClient()
      const { data: fieldsData, error } = await supabase
        .from("table_fields")
        .select("*")
        .eq("table_id", selectedTableId)
        .order("position", { ascending: true })

      if (error) throw error
      setFields((fieldsData || []) as TableField[])
    } catch (error) {
      console.error("Error loading fields:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleTableChange = async (tableId: string) => {
    setSelectedTableId(tableId)
    
    // Update page's base_table
    if (onTableChange) {
      await onTableChange(tableId)
    }
    
    // Reset field configurations when table changes
    await onUpdate({
      table_id: tableId,
      visible_fields: [],
      editable_fields: [],
      title_field: undefined,
    })
  }

  const handleFieldVisibilityChange = (fieldName: string, visible: boolean) => {
    const updated = [...fieldConfigList]
    const index = updated.findIndex((f) => f.field === fieldName)
    
    if (index >= 0) {
      updated[index].visible = visible
      
      // If making visible, ensure it has an order
      if (visible && updated[index].order === -1) {
        updated[index].order = Math.max(...updated.map((f) => f.order), -1) + 1
      }
      
      setFieldConfigList(updated)
      saveFieldConfigs(updated)
    }
  }

  const handleFieldEditableChange = (fieldName: string, editable: boolean) => {
    const updated = [...fieldConfigList]
    const index = updated.findIndex((f) => f.field === fieldName)
    
    if (index >= 0) {
      updated[index].editable = editable
      setFieldConfigList(updated)
      saveFieldConfigs(updated)
    }
  }

  const handleFieldOrderChange = (fieldName: string, direction: "up" | "down") => {
    const updated = [...fieldConfigList]
    const index = updated.findIndex((f) => f.field === fieldName)
    
    if (index < 0) return
    
    const targetIndex = direction === "up" ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= updated.length) return
    
    // Swap orders
    const tempOrder = updated[index].order
    updated[index].order = updated[targetIndex].order
    updated[targetIndex].order = tempOrder
    
    // Sort by order
    updated.sort((a, b) => a.order - b.order)
    
    setFieldConfigList(updated)
    saveFieldConfigs(updated)
  }

  const saveFieldConfigs = async (configs: FieldConfig[]) => {
    const visibleFields = configs
      .filter((f) => f.visible)
      .sort((a, b) => a.order - b.order)
      .map((f) => f.field)
    
    const editableFields = configs
      .filter((f) => f.visible && f.editable)
      .map((f) => f.field)
    
    await onUpdate({
      visible_fields: visibleFields,
      editable_fields: editableFields,
      detail_fields: visibleFields, // Keep for backward compatibility
    })
  }

  const visibleFieldConfigs = fieldConfigList.filter((f) => f.visible)
  const hiddenFieldConfigs = fieldConfigList.filter((f) => !f.visible)
  const pageEditable = config.allow_editing !== false

  return (
    <div className="space-y-6">
      <Tabs defaultValue="data" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="data">Data</TabsTrigger>
          <TabsTrigger value="permissions">Permissions</TabsTrigger>
          <TabsTrigger value="layout">Layout</TabsTrigger>
        </TabsList>

        {/* Data Tab */}
        <TabsContent value="data" className="mt-6 space-y-6">
          {/* Source Table */}
          <div className="space-y-2">
            <Label>Source Table *</Label>
            <Select
              value={selectedTableId}
              onValueChange={handleTableChange}
              disabled={loading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a table" />
              </SelectTrigger>
              <SelectContent>
                {tables.map((table) => (
                  <SelectItem key={table.id} value={table.id}>
                    {table.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500">
              The table that contains the records to display in this Record View.
            </p>
          </div>

          {/* Title Field */}
          {selectedTableId && (
            <div className="space-y-2">
              <Label>Title Field</Label>
              <Select
                value={config.title_field || ""}
                onValueChange={(value) =>
                  onUpdate({ title_field: value || undefined })
                }
                disabled={!selectedTableId || fields.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a field to use as the record title" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None (use record ID)</SelectItem>
                  {fields.map((field) => (
                    <SelectItem key={field.id} value={field.name}>
                      {field.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                The field used to display the record title in the structured field list.
              </p>
            </div>
          )}

          {/* Visible Fields */}
          {selectedTableId && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Visible Fields</Label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const allVisible = fieldConfigList.map((f) => ({
                        ...f,
                        visible: true,
                        order: f.order === -1 ? fieldConfigList.length : f.order,
                      }))
                      setFieldConfigList(allVisible)
                      saveFieldConfigs(allVisible)
                    }}
                    className="text-xs text-blue-600 hover:text-blue-700 underline"
                  >
                    Select All
                  </button>
                  <span className="text-xs text-gray-300">|</span>
                  <button
                    type="button"
                    onClick={() => {
                      const allHidden = fieldConfigList.map((f) => ({
                        ...f,
                        visible: false,
                      }))
                      setFieldConfigList(allHidden)
                      saveFieldConfigs(allHidden)
                    }}
                    className="text-xs text-blue-600 hover:text-blue-700 underline"
                  >
                    Select None
                  </button>
                </div>
              </div>
              <p className="text-xs text-gray-500">
                Select which fields appear in the structured field list. Drag to reorder, and set
                editability per field.
              </p>

              {/* Visible Fields List */}
              {visibleFieldConfigs.length > 0 && (
                <div className="space-y-2 border rounded-lg p-3 bg-gray-50">
                  {visibleFieldConfigs.map((fieldConfig, index) => {
                    const field = fields.find((f) => f.name === fieldConfig.field)
                    if (!field) return null

                    return (
                      <div
                        key={fieldConfig.field}
                        className="flex items-center gap-2 p-2 bg-white rounded border"
                      >
                        <GripVertical className="h-4 w-4 text-gray-400 cursor-move" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate">
                            {field.name}
                          </div>
                          <div className="text-xs text-gray-500">{field.type}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              handleFieldEditableChange(
                                fieldConfig.field,
                                !fieldConfig.editable
                              )
                            }
                            className={cn(
                              "p-1.5 rounded",
                              fieldConfig.editable && pageEditable
                                ? "text-blue-600 hover:bg-blue-50"
                                : "text-gray-400 hover:bg-gray-50"
                            )}
                            disabled={!pageEditable}
                            title={fieldConfig.editable ? "Editable" : "View-only"}
                          >
                            {fieldConfig.editable && pageEditable ? (
                              <Edit2 className="h-4 w-4" />
                            ) : (
                              <Lock className="h-4 w-4" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleFieldOrderChange(fieldConfig.field, "up")
                            }
                            disabled={index === 0}
                            className="p-1.5 rounded text-gray-400 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <ArrowUp className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleFieldOrderChange(fieldConfig.field, "down")
                            }
                            disabled={index === visibleFieldConfigs.length - 1}
                            className="p-1.5 rounded text-gray-400 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <ArrowDown className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleFieldVisibilityChange(fieldConfig.field, false)
                            }
                            className="p-1.5 rounded text-gray-400 hover:bg-gray-50"
                          >
                            <EyeOff className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Hidden Fields List */}
              {hiddenFieldConfigs.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs text-gray-500">Hidden Fields</Label>
                  <div className="space-y-1 border rounded-lg p-3">
                    {hiddenFieldConfigs.map((fieldConfig) => {
                      const field = fields.find((f) => f.name === fieldConfig.field)
                      if (!field) return null

                      return (
                        <div
                          key={fieldConfig.field}
                          className="flex items-center justify-between p-2 hover:bg-gray-50 rounded"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-gray-600 truncate">
                              {field.name}
                            </div>
                            <div className="text-xs text-gray-400">{field.type}</div>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              handleFieldVisibilityChange(fieldConfig.field, true)
                            }
                            className="p-1.5 rounded text-gray-400 hover:bg-gray-100"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {fields.length === 0 && (
                <div className="text-sm text-gray-500 py-4 text-center border rounded-lg">
                  No fields available. Select a table first.
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* Permissions Tab */}
        <TabsContent value="permissions" className="mt-6 space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Page Permissions</Label>
                <p className="text-xs text-gray-500 mt-1">
                  Page-level permissions act as a ceiling. Block permissions cannot exceed page
                  permissions.
                </p>
              </div>
              <Select
                value={pageEditable ? "editable" : "view_only"}
                onValueChange={(value) =>
                  onUpdate({ allow_editing: value === "editable" })
                }
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="view_only">View-only</SelectItem>
                  <SelectItem value="editable">Editable</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {!pageEditable && visibleFieldConfigs.some((f) => f.editable) && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-sm text-yellow-800">
                  Some fields are configured as editable, but the page is view-only. These fields
                  will be displayed as view-only.
                </p>
              </div>
            )}

            <div className="border-t pt-4">
              <p className="text-xs text-gray-500">
                Field-level editability settings are configured in the Data tab. Individual fields
                can be set to view-only even if the page is editable.
              </p>
            </div>
          </div>
        </TabsContent>

        {/* Layout Tab */}
        <TabsContent value="layout" className="mt-6 space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Show Structured Field List</Label>
                <p className="text-xs text-gray-500 mt-1">
                  Display the fixed field list tied to the Record View page. This cannot be deleted
                  but can be hidden.
                </p>
              </div>
              <Switch
                checked={config.show_field_list !== false}
                onCheckedChange={(checked) =>
                  onUpdate({ show_field_list: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Show Blocks Section</Label>
                <p className="text-xs text-gray-500 mt-1">
                  Display the flexible blocks section for context and relationships (notes, related
                  records, etc.).
                </p>
              </div>
              <Switch
                checked={config.show_blocks_section !== false}
                onCheckedChange={(checked) =>
                  onUpdate({ show_blocks_section: checked })
                }
              />
            </div>

            {/* Field Sections (Future) */}
            <div className="border-t pt-4">
              <Label className="text-sm text-gray-500">Field Sections (Coming Soon)</Label>
              <p className="text-xs text-gray-500 mt-1">
                Organize fields into collapsible sections.
              </p>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}