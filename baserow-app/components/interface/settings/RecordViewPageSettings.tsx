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

import { useState, useEffect, useCallback, useMemo } from "react"
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
import { Input } from "@/components/ui/input"
import { ArrowUp, ArrowDown, GripVertical, Eye, EyeOff, Edit2, Lock, Settings } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { resolveChoiceColor, normalizeHexColor, getTextColorForBackground } from "@/lib/field-colors"
import type { PageConfig } from "@/lib/interface/page-config"
import type { Table, TableField } from "@/types/database"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import { getFieldDisplayName } from "@/lib/fields/display"
import FieldPickerModal from "@/components/interface/FieldPickerModal"
import FilterBuilder from "@/components/filters/FilterBuilder"
import { filterConfigsToFilterTree } from "@/lib/filters/converters"
import type { FilterTree } from "@/lib/filters/canonical-model"
import NestedGroupBySelector from "./shared/NestedGroupBySelector"
import type { GroupRule } from "@/lib/grouping/types"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

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
  // Initialize from config.table_id, config.base_table, or page.base_table
  // Also sync when config changes (e.g., when page is loaded with base_table)
  const [selectedTableId, setSelectedTableId] = useState<string>(
    config.table_id || (config as any).base_table || (config as any).tableId || ""
  )
  
  // Sync selectedTableId when config changes (e.g., page loads with base_table)
  useEffect(() => {
    const tableIdFromConfig = config.table_id || (config as any).base_table || (config as any).tableId || ""
    if (tableIdFromConfig && tableIdFromConfig !== selectedTableId) {
      setSelectedTableId(tableIdFromConfig)
    }
  }, [config.table_id, (config as any).base_table, (config as any).tableId])
  const [fields, setFields] = useState<TableField[]>([])
  const [loading, setLoading] = useState(false)
  const [fieldPickerOpen, setFieldPickerOpen] = useState(false)
  
  // Left panel settings state
  const leftPanelConfig: NonNullable<PageConfig['left_panel']> = config.left_panel || {}
  // Support both old flat format and new FilterTree format
  const initialFilterTree: FilterTree = leftPanelConfig.filter_tree 
    ? leftPanelConfig.filter_tree
    : (leftPanelConfig.filter_by && leftPanelConfig.filter_by.length > 0 
        ? filterConfigsToFilterTree(leftPanelConfig.filter_by, 'AND')
        : null)
  const [leftPanelFilterTree, setLeftPanelFilterTree] = useState<FilterTree>(initialFilterTree)
  const [leftPanelSortBy, setLeftPanelSortBy] = useState<string>(leftPanelConfig.sort_by?.[0]?.field || "")
  const [leftPanelSortDirection, setLeftPanelSortDirection] = useState<'asc' | 'desc'>(leftPanelConfig.sort_by?.[0]?.direction || 'asc')
  const [leftPanelGroupBy, setLeftPanelGroupBy] = useState<string>(leftPanelConfig.group_by || "")
  const [leftPanelGroupByRules, setLeftPanelGroupByRules] = useState<GroupRule[] | undefined>(leftPanelConfig.group_by_rules || undefined)
  const [leftPanelColorField, setLeftPanelColorField] = useState<string>(leftPanelConfig.color_field || "")
  const [leftPanelImageField, setLeftPanelImageField] = useState<string>(leftPanelConfig.image_field || "")
  const [leftPanelTitleField, setLeftPanelTitleField] = useState<string>(leftPanelConfig.title_field || config.title_field || "")
  const [leftPanelField1, setLeftPanelField1] = useState<string>(leftPanelConfig.field_1 || "")
  const [leftPanelField2, setLeftPanelField2] = useState<string>(leftPanelConfig.field_2 || "")

  // Sync state with config changes
  useEffect(() => {
    const leftPanel: NonNullable<PageConfig['left_panel']> = config.left_panel || {}
    // Support both old flat format and new FilterTree format
    const newFilterTree: FilterTree = leftPanel.filter_tree 
      ? leftPanel.filter_tree
      : (leftPanel.filter_by && leftPanel.filter_by.length > 0 
          ? filterConfigsToFilterTree(leftPanel.filter_by, 'AND')
          : null)
    setLeftPanelFilterTree(newFilterTree)
    setLeftPanelSortBy(leftPanel.sort_by?.[0]?.field || "")
    setLeftPanelSortDirection(leftPanel.sort_by?.[0]?.direction || 'asc')
    setLeftPanelGroupBy(leftPanel.group_by || "")
    setLeftPanelGroupByRules(leftPanel.group_by_rules || undefined)
    setLeftPanelColorField(leftPanel.color_field || "")
    setLeftPanelImageField(leftPanel.image_field || "")
    setLeftPanelTitleField(leftPanel.title_field || config.title_field || "")
    setLeftPanelField1(leftPanel.field_1 || "")
    setLeftPanelField2(leftPanel.field_2 || "")
  }, [config.left_panel, config.title_field])
  
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
        .select("*, options")
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

  // Get appropriate operators for a field type
  function getOperatorsForFieldType(fieldType: string) {
    switch (fieldType) {
      case "text":
      case "long_text":
        return [
          { value: "contains", label: "Contains" },
          { value: "not_contains", label: "Does not contain" },
          { value: "equal", label: "Equals" },
          { value: "not_equal", label: "Does not equal" },
          { value: "is_empty", label: "Is empty" },
          { value: "is_not_empty", label: "Is not empty" },
        ]
      case "number":
      case "currency":
      case "percent":
        return [
          { value: "equal", label: "Equals" },
          { value: "not_equal", label: "Does not equal" },
          { value: "greater_than", label: "Greater than" },
          { value: "greater_than_or_equal", label: "Greater than or equal" },
          { value: "less_than", label: "Less than" },
          { value: "less_than_or_equal", label: "Less than or equal" },
          { value: "is_empty", label: "Is empty" },
          { value: "is_not_empty", label: "Is not empty" },
        ]
      case "date":
        return [
          { value: "date_equal", label: "Is" },
          { value: "date_before", label: "Before" },
          { value: "date_after", label: "After" },
          { value: "date_on_or_before", label: "On or before" },
          { value: "date_on_or_after", label: "On or after" },
          { value: "is_empty", label: "Is empty" },
          { value: "is_not_empty", label: "Is not empty" },
        ]
      case "single_select":
      case "multi_select":
        return [
          { value: "equal", label: "Is" },
          { value: "not_equal", label: "Is not" },
          { value: "is_empty", label: "Is empty" },
          { value: "is_not_empty", label: "Is not empty" },
        ]
      case "checkbox":
        return [
          { value: "equal", label: "Is checked" },
          { value: "not_equal", label: "Is unchecked" },
        ]
      default:
        return [
          { value: "equal", label: "Equals" },
          { value: "not_equal", label: "Does not equal" },
          { value: "is_empty", label: "Is empty" },
          { value: "is_not_empty", label: "Is not empty" },
        ]
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

  // Drag and drop handlers
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = visibleFieldConfigs.findIndex((f) => f.field === active.id)
      const newIndex = visibleFieldConfigs.findIndex((f) => f.field === over.id)

      if (oldIndex !== -1 && newIndex !== -1) {
        const reordered = arrayMove(visibleFieldConfigs, oldIndex, newIndex)
        
        // Update orders based on new positions
        const updated = reordered.map((fieldConfig, index) => ({
          ...fieldConfig,
          order: index,
        }))
        
        // Merge with hidden fields
        const allUpdated = [
          ...updated,
          ...fieldConfigList.filter((f) => !f.visible),
        ]
        
        setFieldConfigList(allUpdated)
        saveFieldConfigs(allUpdated)
      }
    }
  }

  // Sortable field item component
  function SortableFieldItem({ fieldConfig, index }: { fieldConfig: FieldConfig; index: number }) {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id: fieldConfig.field })

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
    }

    const field = fields.find((f) => f.name === fieldConfig.field)
    if (!field) return null

    // Check if this is a select field and show a sample color pill
    const sampleChoice = field.options?.choices?.[0]
    let colorBadge = null
    
    if ((field.type === 'single_select' || field.type === 'multi_select') && sampleChoice) {
      const hexColor = resolveChoiceColor(
        sampleChoice,
        field.type,
        field.options,
        field.type === 'single_select'
      )
      const normalizedColor = normalizeHexColor(hexColor)
      const textColor = getTextColorForBackground(normalizedColor)
      
      colorBadge = (
        <Badge
          className={cn('text-xs', textColor)}
          style={{ backgroundColor: normalizedColor }}
        >
          {sampleChoice}
        </Badge>
      )
    }

    return (
      <div
        ref={setNodeRef}
        style={style}
        className={cn(
          "flex items-center gap-2 p-2 bg-white rounded border",
          isDragging && "shadow-lg"
        )}
      >
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing"
        >
          <GripVertical className="h-4 w-4 text-gray-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className="text-sm font-medium text-gray-900 truncate">
              {getFieldDisplayName(field)}
            </div>
            {colorBadge}
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
              handleFieldVisibilityChange(fieldConfig.field, false)
            }
            className="p-1.5 rounded text-gray-400 hover:bg-gray-50"
          >
            <EyeOff className="h-4 w-4" />
          </button>
        </div>
      </div>
    )
  }

  // Create field blocks from field names
  const createFieldBlocksFromNames = async (fieldNames: string[]) => {
    if (!selectedTableId || !pageId || fieldNames.length === 0) return
    
    try {
      // Get field IDs from field names
      const fieldIds = fields
        .filter(f => fieldNames.includes(f.name))
        .map(f => f.id)
      
      if (fieldIds.length === 0) return
      
      // Get existing blocks to determine starting position and avoid duplicates
      const blocksResponse = await fetch(`/api/pages/${pageId}/blocks`)
      const blocksData = blocksResponse.ok ? await blocksResponse.json() : { blocks: [] }
      const existingBlocks = blocksData.blocks || []
      
      // Get existing field block field IDs to avoid duplicates
      const existingFieldIds = existingBlocks
        .filter((b: any) => b.type === 'field' && b.config?.field_id)
        .map((b: any) => b.config.field_id)
      
      // Filter out fields that already have blocks
      const fieldsToCreate = fieldIds.filter(id => !existingFieldIds.includes(id))
      
      if (fieldsToCreate.length === 0) {
        return // All fields already have blocks
      }
      
      // Calculate grid layout: 2 columns, 6 wide each (half of 12-column grid)
      const colsPerRow = 2
      const blockWidth = 6 // 6 columns each (half of 12-column grid)
      const blockHeight = 3 // Default height
      const marginY = 1 // Vertical spacing
      
      // Find the maximum Y position to start below existing blocks
      const maxY = existingBlocks.length > 0
        ? Math.max(...existingBlocks.map((b: any) => (b.y || 0) + (b.h || 4)))
        : 0
      
      const startY = maxY + marginY
      
      // Create blocks in grid layout via API, maintaining field order
      for (let i = 0; i < fieldsToCreate.length; i++) {
        const fieldId = fieldsToCreate[i]
        const row = Math.floor(i / colsPerRow)
        const col = i % colsPerRow
        
        const x = col * blockWidth
        const y = startY + (row * (blockHeight + marginY))
        
        const response = await fetch(`/api/pages/${pageId}/blocks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'field',
            x,
            y,
            w: blockWidth,
            h: blockHeight,
            config: {
              field_id: fieldId,
              table_id: selectedTableId,
            },
          }),
        })

        if (!response.ok) {
          const error = await response.json()
          console.error('Failed to create field block:', error)
          // Continue creating other blocks even if one fails
        }
      }
    } catch (error) {
      console.error('Error creating field blocks:', error)
      // Don't throw - allow page save to complete even if block creation fails
    }
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
    
    // Auto-create field blocks for visible fields
    await createFieldBlocksFromNames(visibleFields)
  }

  const visibleFieldConfigs = fieldConfigList.filter((f) => f.visible)
  const hiddenFieldConfigs = fieldConfigList.filter((f) => !f.visible)
  const pageEditable = config.allow_editing !== false

  // Record action permissions (create/delete) for record pages
  const recordActions = ((config as any).record_actions || {}) as {
    create?: 'admin' | 'both'
    delete?: 'admin' | 'both'
  }
  const recordCreatePermission: 'admin' | 'both' = recordActions.create || 'both'
  const recordDeletePermission: 'admin' | 'both' = recordActions.delete || 'admin'

  // Group visible fields by their group_name
  const groupedVisibleFields = useMemo(() => {
    const groups: Record<string, typeof visibleFieldConfigs> = {}
    const ungrouped: typeof visibleFieldConfigs = []
    
    visibleFieldConfigs.forEach((fieldConfig) => {
      const field = fields.find((f) => f.name === fieldConfig.field)
      const groupName = field?.group_name || null
      
      if (groupName) {
        if (!groups[groupName]) {
          groups[groupName] = []
        }
        groups[groupName].push(fieldConfig)
      } else {
        ungrouped.push(fieldConfig)
      }
    })
    
    return { groups, ungrouped }
  }, [visibleFieldConfigs, fields])

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
                value={config.title_field || "__none__"}
                onValueChange={(value) => {
                  const fieldName = value === "__none__" ? undefined : value
                  onUpdate({
                    title_field: fieldName,
                    left_panel: {
                      ...(config.left_panel || {}),
                      title_field: fieldName,
                    },
                  })
                }}
                disabled={!selectedTableId || fields.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a field to use as the record title" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None (use record ID)</SelectItem>
                  {fields.map((field) => (
                    <SelectItem key={field.id} value={field.name}>
                      {getFieldDisplayName(field)}
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
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setFieldPickerOpen(true)}
                  className="h-7 text-xs"
                >
                  <Settings className="h-3 w-3 mr-1.5" />
                  Pick elements
                </Button>
              </div>
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
              <p className="text-xs text-gray-500">
                Select which fields appear in the structured field list. Drag to reorder, and set
                editability per field.
              </p>

              {/* Visible Fields List - Drag and Drop with Grouping */}
              {visibleFieldConfigs.length > 0 && (
                <div className="space-y-3 border rounded-lg p-3 bg-gray-50">
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext
                      items={visibleFieldConfigs.map((f) => f.field)}
                      strategy={verticalListSortingStrategy}
                    >
                      {/* Ungrouped fields */}
                      {groupedVisibleFields.ungrouped.length > 0 && (
                        <div className="space-y-2">
                          {groupedVisibleFields.ungrouped.map((fieldConfig, index) => (
                            <SortableFieldItem
                              key={fieldConfig.field}
                              fieldConfig={fieldConfig}
                              index={index}
                            />
                          ))}
                        </div>
                      )}
                      
                      {/* Grouped fields */}
                      {Object.entries(groupedVisibleFields.groups).map(([groupName, groupFields]) => (
                        <div key={groupName} className="space-y-2">
                          <div className="px-2 py-1 text-xs font-semibold text-gray-600 uppercase tracking-wider bg-gray-100 rounded">
                            {groupName}
                          </div>
                          {groupFields.map((fieldConfig, index) => (
                            <SortableFieldItem
                              key={fieldConfig.field}
                              fieldConfig={fieldConfig}
                              index={index}
                            />
                          ))}
                        </div>
                      ))}
                    </SortableContext>
                  </DndContext>
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
                              {getFieldDisplayName(field)}
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

          {/* Left Panel Settings */}
          {selectedTableId && (
            <>
              <div className="border-t my-6"></div>
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-1">Left Panel Settings</h3>
                  <p className="text-xs text-gray-500">
                    Configure how records appear in the left panel (record list).
                  </p>
                </div>

                {/* Data Options */}
                <div className="space-y-4">
                  <div>
                    <h4 className="text-xs font-medium text-gray-700 uppercase mb-3">Data</h4>
                    
                    {/* Filter by - Using FilterBuilder for full group support */}
                    <div className="space-y-2">
                      <Label>Filter by</Label>
                      {selectedTableId && fields.length > 0 ? (
                        <div className="border rounded-lg p-3 bg-gray-50">
                          <FilterBuilder
                            filterTree={leftPanelFilterTree}
                            tableFields={fields}
                            onChange={(newFilterTree) => {
                              setLeftPanelFilterTree(newFilterTree)
                              onUpdate({
                                left_panel: {
                                  ...leftPanelConfig,
                                  filter_tree: newFilterTree,
                                  // Keep legacy filter_by for backward compatibility
                                  filter_by: newFilterTree ? (() => {
                                    // Convert FilterTree to flat format for backward compatibility
                                    const flatFilters: Array<{ field: string; operator: string; value: any }> = []
                                    function extractConditions(tree: FilterTree) {
                                      if (!tree) return
                                      if ('field_id' in tree) {
                                        const filterValue = tree.value !== undefined ? tree.value : null
                                        flatFilters.push({
                                          field: tree.field_id,
                                          operator: tree.operator,
                                          value: filterValue,
                                        })
                                      } else if ('operator' in tree && 'children' in tree) {
                                        tree.children.forEach(child => extractConditions(child))
                                      }
                                    }
                                    extractConditions(newFilterTree)
                                    return flatFilters
                                  })() : [],
                                }
                              })
                            }}
                          />
                        </div>
                      ) : (
                        <p className="text-xs text-gray-500">
                          Select a table to configure filters.
                        </p>
                      )}
                      <p className="text-xs text-gray-500">
                        Filter records in the left panel. Supports AND/OR groups and nested conditions.
                      </p>
                    </div>

                    {/* Sort by */}
                    <div className="space-y-2">
                      <Label>Sort by</Label>
                      <div className="flex gap-2">
                        <Select 
                          value={leftPanelSortBy || "__none__"} 
                          onValueChange={(value) => {
                            const fieldName = value === "__none__" ? "" : value
                            setLeftPanelSortBy(fieldName)
                            const newSortBy = fieldName ? [{ field: fieldName, direction: leftPanelSortDirection }] : []
                            onUpdate({
                              left_panel: {
                                ...leftPanelConfig,
                                sort_by: newSortBy,
                              }
                            })
                          }}
                          disabled={!selectedTableId || fields.length === 0}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="None" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">None</SelectItem>
                            {fields.map((field) => (
                              <SelectItem key={field.id} value={field.name}>
                                {getFieldDisplayName(field)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {leftPanelSortBy && (
                          <Select 
                            value={leftPanelSortDirection} 
                            onValueChange={(value: 'asc' | 'desc') => {
                              setLeftPanelSortDirection(value)
                              onUpdate({
                                left_panel: {
                                  ...leftPanelConfig,
                                  sort_by: [{ field: leftPanelSortBy, direction: value }],
                                }
                              })
                            }}
                          >
                            <SelectTrigger className="w-24">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="asc">Asc</SelectItem>
                              <SelectItem value="desc">Desc</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">
                        Default sort order for records.
                      </p>
                    </div>

                    {/* Group by - Support nested groups */}
                    <div className="space-y-2">
                      <Label>Group by</Label>
                      <NestedGroupBySelector
                        value={leftPanelGroupBy || undefined}
                        groupByRules={leftPanelGroupByRules}
                        onChange={(value) => {
                          const fieldName = value === "__none__" || !value ? "" : value
                          setLeftPanelGroupBy(fieldName)
                          onUpdate({
                            left_panel: {
                              ...leftPanelConfig,
                              group_by: fieldName || undefined,
                              // Clear group_by_rules if using legacy single field
                              ...(fieldName ? {} : { group_by_rules: undefined }),
                            }
                          })
                        }}
                        onRulesChange={(rules) => {
                          const normalizedRules = rules ?? undefined
                          setLeftPanelGroupByRules(normalizedRules)
                          onUpdate({
                            left_panel: {
                              ...leftPanelConfig,
                              group_by_rules: normalizedRules,
                              // For backward compatibility, also set group_by to first rule's field
                              group_by: normalizedRules && normalizedRules.length > 0 && normalizedRules[0].type === 'field' ? normalizedRules[0].field : undefined,
                            }
                          })
                        }}
                        fields={fields}
                        filterGroupableFields={true}
                        description="Add up to 2 grouping levels to group records into nested collapsible sections (like Airtable)."
                      />
                    </div>
                  </div>
                </div>

                {/* List Item Display */}
                <div className="space-y-4">
                  <div>
                    <h4 className="text-xs font-medium text-gray-700 uppercase mb-3">List Item</h4>
                    
                    {/* Color */}
                    <div className="space-y-2">
                      <Label>Color</Label>
                      <Select 
                        value={leftPanelColorField || "__none__"} 
                        onValueChange={(value) => {
                          const fieldName = value === "__none__" ? "" : value
                          setLeftPanelColorField(fieldName)
                          onUpdate({
                            left_panel: {
                              ...leftPanelConfig,
                              color_field: fieldName || undefined,
                            }
                          })
                        }}
                        disabled={!selectedTableId || fields.length === 0}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="None" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">None</SelectItem>
                          {fields
                            .filter(f => f.type === 'single_select' || f.type === 'multi_select')
                            .map((field) => (
                              <SelectItem key={field.id} value={field.name}>
                                {getFieldDisplayName(field)}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-gray-500">
                        Field to use for item color (select fields only).
                      </p>
                    </div>

                    {/* Image field */}
                    <div className="space-y-2">
                      <Label>Image field</Label>
                      <Select 
                        value={leftPanelImageField || "__none__"} 
                        onValueChange={(value) => {
                          const fieldName = value === "__none__" ? "" : value
                          setLeftPanelImageField(fieldName)
                          onUpdate({
                            left_panel: {
                              ...leftPanelConfig,
                              image_field: fieldName || undefined,
                            }
                          })
                        }}
                        disabled={!selectedTableId || fields.length === 0}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="None" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">None</SelectItem>
                          {fields
                            .filter(f => f.type === 'attachment' || f.type === 'url')
                            .map((field) => (
                              <SelectItem key={field.id} value={field.name}>
                                {getFieldDisplayName(field)}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-gray-500">
                        Field to display as image in list items.
                      </p>
                    </div>

                    {/* Title */}
                    <div className="space-y-2">
                      <Label>Title</Label>
                      <Select
                        value={leftPanelTitleField || "__none__"}
                        onValueChange={(value) => {
                          const fieldName = value === "__none__" ? "" : value
                          setLeftPanelTitleField(fieldName)
                          // Update both left_panel.title_field and page-level title_field
                          onUpdate({ 
                            title_field: fieldName || undefined,
                            left_panel: {
                              ...leftPanelConfig,
                              title_field: fieldName || undefined,
                            }
                          })
                        }}
                        disabled={!selectedTableId || fields.length === 0}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a field" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">None</SelectItem>
                          {fields.map((field) => (
                            <SelectItem key={field.id} value={field.name}>
                              {getFieldDisplayName(field)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-gray-500">
                        Field to use as the primary title in list items.
                      </p>
                    </div>

                    {/* Field 1 */}
                    <div className="space-y-2">
                      <Label>Field 1</Label>
                      <Select 
                        value={leftPanelField1 || "__none__"} 
                        onValueChange={(value) => {
                          const fieldName = value === "__none__" ? "" : value
                          setLeftPanelField1(fieldName)
                          onUpdate({
                            left_panel: {
                              ...leftPanelConfig,
                              field_1: fieldName || undefined,
                            }
                          })
                        }}
                        disabled={!selectedTableId || fields.length === 0}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="None" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">None</SelectItem>
                          {fields.map((field) => (
                            <SelectItem key={field.id} value={field.name}>
                              {getFieldDisplayName(field)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-gray-500">
                        First additional field to display in list items.
                      </p>
                    </div>

                    {/* Field 2 */}
                    <div className="space-y-2">
                      <Label>Field 2</Label>
                      <Select 
                        value={leftPanelField2 || "__none__"} 
                        onValueChange={(value) => {
                          const fieldName = value === "__none__" ? "" : value
                          setLeftPanelField2(fieldName)
                          onUpdate({
                            left_panel: {
                              ...leftPanelConfig,
                              field_2: fieldName || undefined,
                            }
                          })
                        }}
                        disabled={!selectedTableId || fields.length === 0}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="None" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">None</SelectItem>
                          {fields.map((field) => (
                            <SelectItem key={field.id} value={field.name}>
                              {getFieldDisplayName(field)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-gray-500">
                        Second additional field to display in list items.
                      </p>
                    </div>
                  </div>
                </div>

                {/* User Actions */}
                <div className="space-y-4">
                  <div>
                    <h4 className="text-xs font-medium text-gray-700 uppercase mb-3">User Actions</h4>
                    <p className="text-xs text-gray-500 mb-3">
                      Enable or disable user actions in the left panel (coming soon).
                    </p>
                    
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-normal">Sort</Label>
                        <Switch checked={false} onCheckedChange={() => {}} disabled />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-normal">Filter</Label>
                        <Switch checked={false} onCheckedChange={() => {}} disabled />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-normal">Group</Label>
                        <Switch checked={false} onCheckedChange={() => {}} disabled />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-normal">Add records through a form</Label>
                        <Switch checked={false} onCheckedChange={() => {}} disabled />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-normal">Buttons</Label>
                        <Switch checked={false} onCheckedChange={() => {}} disabled />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
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

            <div className="border-t pt-4 space-y-4">
              <div>
                <Label>Record actions</Label>
                <p className="text-xs text-gray-500 mt-1">
                  Control who can create and delete records from this Record View page UI.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Create records (+)</Label>
                  <Select
                    value={recordCreatePermission}
                    onValueChange={(value) =>
                      onUpdate({
                        record_actions: {
                          ...(recordActions || {}),
                          create: value as any,
                        },
                      } as any)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin only</SelectItem>
                      <SelectItem value="both">Admins + members</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Delete records (−)</Label>
                  <Select
                    value={recordDeletePermission}
                    onValueChange={(value) =>
                      onUpdate({
                        record_actions: {
                          ...(recordActions || {}),
                          delete: value as any,
                        },
                      } as any)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin only</SelectItem>
                      <SelectItem value="both">Admins + members</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

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

            <div className="flex items-center justify-between">
              <div>
                <Label>Default “Add record” buttons</Label>
                <p className="text-xs text-gray-500 mt-1">
                  Show “Add record” inside data blocks by default (blocks can override).
                </p>
              </div>
              <Switch
                checked={(config as any).show_add_record === true}
                onCheckedChange={(checked) => onUpdate({ show_add_record: checked } as any)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Show field names on blocks</Label>
                <p className="text-xs text-gray-500 mt-1">
                  Display the field name (label) above each field block. Individual blocks can still
                  hide their label in block appearance settings.
                </p>
              </div>
              <Switch
                checked={config.show_field_names !== false}
                onCheckedChange={(checked) =>
                  onUpdate({ show_field_names: checked })
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

      {/* Field Picker Modal */}
      <FieldPickerModal
        open={fieldPickerOpen}
        onOpenChange={setFieldPickerOpen}
        tableId={selectedTableId}
        selectedFields={fieldConfigList.filter((f) => f.visible).map((f) => f.field)}
        onFieldsChange={(fieldNames) => {
          // Update field configs based on selected fields
          const updated = fieldConfigList.map((fc) => ({
            ...fc,
            visible: fieldNames.includes(fc.field),
          }))
          setFieldConfigList(updated)
          saveFieldConfigs(updated)
        }}
      />
    </div>
  )
}