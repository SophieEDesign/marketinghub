"use client"

/**
 * Record Review Left Panel Settings Component
 * 
 * This component allows users to configure which fields appear in the left column
 * of a Record Review page. This is page-level configuration, not block configuration.
 * 
 * Settings are stored in: page.settings.leftPanel (unified with RecordViewPageSettings)
 */

import { useState, useEffect, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import type { TableField } from "@/types/fields"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { GripVertical, Eye, EyeOff, Settings } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useSelectionContext } from "@/contexts/SelectionContext"
import FilterBuilder from "@/components/filters/FilterBuilder"
import { filterConfigsToFilterTree } from "@/lib/filters/converters"
import type { FilterTree } from "@/lib/filters/canonical-model"
import NestedGroupBySelector from "./settings/shared/NestedGroupBySelector"
import type { GroupRule } from "@/lib/grouping/types"
import { getFieldDisplayName } from "@/lib/fields/display"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

export interface RecordReviewLeftPanelSettingsData {
  visibleFieldIds: string[]
  fieldOrder: string[]
  showLabels: boolean
  compact: boolean
  filter_tree?: FilterTree | null
  filter_by?: Array<{ field: string; operator: string; value: any }>
  sort_by?: Array<{ field: string; direction: "asc" | "desc" }>
  group_by?: string
  group_by_rules?: GroupRule[]
  color_field?: string
  image_field?: string
}

interface RecordReviewLeftPanelSettingsProps {
  tableId: string | null
  currentSettings?: Partial<RecordReviewLeftPanelSettingsData>
  onSettingsChange: (settings: RecordReviewLeftPanelSettingsData) => void
}

export default function RecordReviewLeftPanelSettings({
  tableId,
  currentSettings,
  onSettingsChange,
}: RecordReviewLeftPanelSettingsProps) {
  const [fields, setFields] = useState<TableField[]>([])
  const [loading, setLoading] = useState(false)
  const [visibleFieldIds, setVisibleFieldIds] = useState<string[]>(
    currentSettings?.visibleFieldIds || []
  )
  const [fieldOrder, setFieldOrder] = useState<string[]>(
    currentSettings?.fieldOrder || []
  )
  const [showLabels, setShowLabels] = useState(currentSettings?.showLabels ?? true)
  const [compact, setCompact] = useState(currentSettings?.compact ?? false)
  const [filterTree, setFilterTree] = useState<FilterTree | null>(
    currentSettings?.filter_tree ?? null
  )
  const [sortBy, setSortBy] = useState<string>(currentSettings?.sort_by?.[0]?.field || "")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">(
    currentSettings?.sort_by?.[0]?.direction || "asc"
  )
  const [groupBy, setGroupBy] = useState<string>(currentSettings?.group_by || "")
  const [groupByRules, setGroupByRules] = useState<GroupRule[] | undefined>(
    currentSettings?.group_by_rules || undefined
  )
  const [colorField, setColorField] = useState<string>(currentSettings?.color_field || "")
  const [imageField, setImageField] = useState<string>(currentSettings?.image_field || "")
  const { setSelectedContext } = useSelectionContext()

  // Sync state when currentSettings changes (e.g. load from API)
  useEffect(() => {
    if (!currentSettings) return
    if (currentSettings.filter_tree !== undefined) setFilterTree(currentSettings.filter_tree)
    if (currentSettings.sort_by?.[0]) {
      setSortBy(currentSettings.sort_by[0].field)
      setSortDirection(currentSettings.sort_by[0].direction)
    }
    if (currentSettings.group_by !== undefined) setGroupBy(currentSettings.group_by)
    if (currentSettings.group_by_rules !== undefined) setGroupByRules(currentSettings.group_by_rules)
    if (currentSettings.color_field !== undefined) setColorField(currentSettings.color_field)
    if (currentSettings.image_field !== undefined) setImageField(currentSettings.image_field)
  }, [currentSettings?.filter_tree, currentSettings?.sort_by, currentSettings?.group_by, currentSettings?.group_by_rules, currentSettings?.color_field, currentSettings?.image_field])

  // Load fields from table
  useEffect(() => {
    if (!tableId) return

    async function loadFields() {
      setLoading(true)
      try {
        const supabase = createClient()
        const { data } = await supabase
          .from("table_fields")
          .select("*")
          .eq("table_id", tableId)
          .order("order_index", { ascending: true })

        if (data) {
          setFields(data as TableField[])
          
          // Initialize fieldOrder if not set (use table field order)
          if (fieldOrder.length === 0 && data.length > 0) {
            setFieldOrder(data.map(f => f.id))
          }
          
          // Initialize visibleFieldIds if not set (show all fields)
          if (visibleFieldIds.length === 0 && data.length > 0) {
            setVisibleFieldIds(data.map(f => f.id))
          }
        }
      } catch (error) {
        console.error("Error loading fields:", error)
      } finally {
        setLoading(false)
      }
    }

    loadFields()
  }, [tableId])

  // Get ordered fields based on fieldOrder
  const orderedFields = useMemo(() => {
    if (fieldOrder.length === 0) {
      return fields
    }
    
    // Sort fields by fieldOrder, then append any fields not in fieldOrder
    const ordered = fieldOrder
      .map(id => fields.find(f => f.id === id))
      .filter((f): f is TableField => f !== undefined)
    
    const unordered = fields.filter(f => !fieldOrder.includes(f.id))
    
    return [...ordered, ...unordered]
  }, [fields, fieldOrder])

  // Handle field visibility toggle
  const handleFieldToggle = (fieldId: string) => {
    const newVisibleIds = visibleFieldIds.includes(fieldId)
      ? visibleFieldIds.filter(id => id !== fieldId)
      : [...visibleFieldIds, fieldId]
    
    setVisibleFieldIds(newVisibleIds)
    notifySettingsChange(newVisibleIds, fieldOrder, showLabels, compact)
  }

  // Set up drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Handle drag end (reorder fields)
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const currentOrder = fieldOrder.length > 0 ? fieldOrder : fields.map(f => f.id)
    const oldIndex = currentOrder.indexOf(active.id as string)
    const newIndex = currentOrder.indexOf(over.id as string)

    const newOrder = arrayMove(currentOrder, oldIndex, newIndex)
    setFieldOrder(newOrder)
    notifySettingsChange(visibleFieldIds, newOrder, showLabels, compact)
  }

  // Build full settings and notify parent
  const buildSettings = (
    visibleIds: string[],
    order: string[],
    labels: boolean,
    compactMode: boolean,
    overrides?: Partial<RecordReviewLeftPanelSettingsData>
  ): RecordReviewLeftPanelSettingsData => ({
    visibleFieldIds: visibleIds,
    fieldOrder: order,
    showLabels: labels,
    compact: compactMode,
    filter_tree: filterTree,
    sort_by: sortBy ? [{ field: sortBy, direction: sortDirection }] : undefined,
    group_by: groupBy || undefined,
    group_by_rules: groupByRules,
    color_field: colorField || undefined,
    image_field: imageField || undefined,
    ...overrides,
  })

  const notifySettingsChange = (
    visibleIds: string[],
    order: string[],
    labels: boolean,
    compactMode: boolean,
    overrides?: Partial<RecordReviewLeftPanelSettingsData>
  ) => {
    onSettingsChange(buildSettings(visibleIds, order, labels, compactMode, overrides))
  }

  // Handle display options change
  const handleShowLabelsChange = (checked: boolean) => {
    setShowLabels(checked)
    notifySettingsChange(visibleFieldIds, fieldOrder, checked, compact)
  }

  const handleCompactChange = (checked: boolean) => {
    setCompact(checked)
    notifySettingsChange(visibleFieldIds, fieldOrder, showLabels, checked)
  }

  if (!tableId) {
    return (
      <div className="p-4 text-sm text-gray-500">
        No table selected. Please select a table in page settings.
      </div>
    )
  }

  if (loading) {
    return <div className="p-4 text-sm text-gray-500">Loading fields...</div>
  }

  if (fields.length === 0) {
    return (
      <div className="p-4 text-sm text-gray-500">
        No fields found in this table.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Data options: Filter, Sort, Group */}
      <div className="space-y-4">
        <h4 className="text-xs font-medium text-gray-700 uppercase">Data</h4>

        <div className="space-y-2">
          <Label className="text-sm font-medium">Filter by</Label>
          <div className="border rounded-lg p-3 bg-gray-50">
            <FilterBuilder
              filterTree={filterTree}
              tableFields={fields}
              onChange={(newFilterTree) => {
                setFilterTree(newFilterTree)
                const flatFilters: Array<{ field: string; operator: string; value: any }> = []
                function extractConditions(tree: FilterTree | null) {
                  if (!tree) return
                  if ("field_id" in tree) {
                    flatFilters.push({
                      field: tree.field_id,
                      operator: tree.operator,
                      value: tree.value !== undefined ? tree.value : null,
                    })
                  } else if ("operator" in tree && "children" in tree) {
                    tree.children.forEach((child) => extractConditions(child))
                  }
                }
                extractConditions(newFilterTree)
                notifySettingsChange(visibleFieldIds, fieldOrder, showLabels, compact, {
                  filter_tree: newFilterTree,
                  filter_by: flatFilters,
                })
              }}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium">Sort by</Label>
          <div className="flex gap-2">
            <Select
              value={sortBy || "__none__"}
              onValueChange={(value) => {
                const fieldName = value === "__none__" ? "" : value
                setSortBy(fieldName)
                notifySettingsChange(visibleFieldIds, fieldOrder, showLabels, compact, {
                  sort_by: fieldName ? [{ field: fieldName, direction: sortDirection }] : undefined,
                })
              }}
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
            {sortBy && (
              <Select
                value={sortDirection}
                onValueChange={(value: "asc" | "desc") => {
                  setSortDirection(value)
                  notifySettingsChange(visibleFieldIds, fieldOrder, showLabels, compact, {
                    sort_by: [{ field: sortBy, direction: value }],
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
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium">Group by</Label>
          <NestedGroupBySelector
            value={groupBy || undefined}
            groupByRules={groupByRules}
            onChange={(value) => {
              const fieldName = value === "__none__" || !value ? "" : value
              setGroupBy(fieldName)
              notifySettingsChange(visibleFieldIds, fieldOrder, showLabels, compact, {
                group_by: fieldName || undefined,
                group_by_rules: fieldName ? groupByRules : undefined,
              })
            }}
            onRulesChange={(rules) => {
              const normalizedRules = rules ?? undefined
              setGroupByRules(normalizedRules)
              notifySettingsChange(visibleFieldIds, fieldOrder, showLabels, compact, {
                group_by_rules: normalizedRules,
                group_by: normalizedRules?.[0]?.type === "field" ? normalizedRules[0].field : undefined,
              })
            }}
            fields={fields}
            filterGroupableFields={true}
            description="Group records into collapsible sections."
          />
        </div>
      </div>

      {/* List item display: Color, Image */}
      <div className="space-y-4 pt-2 border-t">
        <h4 className="text-xs font-medium text-gray-700 uppercase">List Item</h4>

        <div className="space-y-2">
          <Label className="text-sm font-medium">Color by</Label>
          <Select
            value={colorField || "__none__"}
            onValueChange={(value) => {
              const fieldName = value === "__none__" ? "" : value
              setColorField(fieldName)
              notifySettingsChange(visibleFieldIds, fieldOrder, showLabels, compact, {
                color_field: fieldName || undefined,
              })
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">None</SelectItem>
              {fields
                .filter((f) => f.type === "single_select" || f.type === "multi_select")
                .map((field) => (
                  <SelectItem key={field.id} value={field.name}>
                    {getFieldDisplayName(field)}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-gray-500">Field to use for item color (select fields only).</p>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium">Image field</Label>
          <Select
            value={imageField || "__none__"}
            onValueChange={(value) => {
              const fieldName = value === "__none__" ? "" : value
              setImageField(fieldName)
              notifySettingsChange(visibleFieldIds, fieldOrder, showLabels, compact, {
                image_field: fieldName || undefined,
              })
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">None</SelectItem>
              {fields
                .filter((f) => f.type === "attachment" || f.type === "url")
                .map((field) => (
                  <SelectItem key={field.id} value={field.name}>
                    {getFieldDisplayName(field)}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-gray-500">Field to display as image in list items.</p>
        </div>
      </div>

      <div className="pt-2 border-t">
        <Label className="text-sm font-semibold">Visible Fields</Label>
        <p className="text-xs text-gray-500 mt-1 mb-3">
          Choose which fields appear in the left column. Drag to reorder.
        </p>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={orderedFields.map(f => f.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {orderedFields.map((field) => {
                const isVisible = visibleFieldIds.includes(field.id)
                return (
                  <SortableFieldItem
                    key={field.id}
                    field={field}
                    isVisible={isVisible}
                    onToggle={() => handleFieldToggle(field.id)}
                    onConfigure={() => tableId && setSelectedContext({ type: "field", fieldId: field.id, tableId })}
                  />
                )
              })}
            </div>
          </SortableContext>
        </DndContext>
      </div>

      <div className="pt-4 border-t space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm font-medium">Show Field Labels</Label>
            <p className="text-xs text-gray-500">Display field names in the left column</p>
          </div>
          <Checkbox
            checked={showLabels}
            onCheckedChange={handleShowLabelsChange}
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm font-medium">Compact Mode</Label>
            <p className="text-xs text-gray-500">Use more compact spacing</p>
          </div>
          <Checkbox
            checked={compact}
            onCheckedChange={handleCompactChange}
          />
        </div>
      </div>

    </div>
  )
}

// Sortable field item component
function SortableFieldItem({
  field,
  isVisible,
  onToggle,
  onConfigure,
}: {
  field: TableField
  isVisible: boolean
  onToggle: () => void
  onConfigure: () => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: field.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 p-2 border rounded-md bg-white ${
        !isVisible ? "opacity-50" : ""
      }`}
    >
      <div {...attributes} {...listeners} className="cursor-grab">
        <GripVertical className="h-4 w-4 text-gray-400" />
      </div>
      
      <Checkbox
        checked={isVisible}
        onCheckedChange={onToggle}
        className="flex-shrink-0"
      />
      
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-900">
          {field.name}
        </div>
        <div className="text-xs text-gray-500">{field.type}</div>
      </div>
      
      <Button
        variant="ghost"
        size="sm"
        onClick={(e) => {
          e.stopPropagation()
          e.preventDefault()
          onConfigure()
        }}
        className="h-7 px-2 text-xs"
        title="Configure field"
      >
        <Settings className="h-3.5 w-3.5" />
      </Button>
      
      {isVisible ? (
        <Eye className="h-4 w-4 text-gray-400" />
      ) : (
        <EyeOff className="h-4 w-4 text-gray-300" />
      )}
    </div>
  )
}
