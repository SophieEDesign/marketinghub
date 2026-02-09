"use client"

/**
 * Record Field Editor Panel Component
 * 
 * Full Airtable-style field editor for the right panel of Record View pages.
 * Features:
 * - Drag-and-drop field reordering
 * - Inline field value editing
 * - Field visibility toggles
 * - Field editability toggles
 * - Field grouping/section management
 * - Search/filter fields
 */

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { Search, GripVertical, Eye, EyeOff, Edit2, Lock, Settings, Plus } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { getFieldDisplayName } from "@/lib/fields/display"
import { resolveChoiceColor, normalizeHexColor, getTextColorForBackground } from "@/lib/field-colors"
import InlineFieldEditor from "@/components/records/InlineFieldEditor"
import type { TableField } from "@/types/fields"
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
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/components/ui/use-toast"
import { syncLinkedFieldBidirectional } from "@/lib/dataView/linkedFields"
import { useRecordPanel } from "@/contexts/RecordPanelContext"
import { isAbortError } from "@/lib/api/error-handling"

interface FieldLayoutItem {
  field_id: string
  field_name: string
  order: number
  visible_in_modal?: boolean
  visible_in_card?: boolean
  visible_in_canvas?: boolean
  editable: boolean
  group_name?: string
}

interface RecordFieldEditorPanelProps {
  tableId: string
  recordId: string | null
  allFields: TableField[]
  fieldLayout?: FieldLayoutItem[]
  onFieldLayoutChange?: (layout: FieldLayoutItem[]) => void
  onFieldChange?: (fieldName: string, value: any) => void
  pageEditable?: boolean
  /** Context mode: 'modal' uses visible_in_modal, 'record_review' uses visible_in_canvas */
  mode?: 'modal' | 'record_review'
}

export default function RecordFieldEditorPanel({
  tableId,
  recordId,
  allFields,
  fieldLayout = [],
  onFieldLayoutChange,
  onFieldChange,
  pageEditable = true,
  mode = 'record_review',
}: RecordFieldEditorPanelProps) {
  const { openRecordByTableId } = useRecordPanel()
  const { toast } = useToast()
  const [recordData, setRecordData] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(false)
  const [editingField, setEditingField] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [localFieldLayout, setLocalFieldLayout] = useState<FieldLayoutItem[]>(fieldLayout)
  const renderCountRef = useRef(0)
  renderCountRef.current += 1
  // #region agent log
  if (process.env.NODE_ENV === 'development') {
    console.count('[RecordFieldEditorPanel] RENDER')
    if (renderCountRef.current <= 10 || renderCountRef.current % 10 === 0) {
      fetch('http://127.0.0.1:7242/ingest/7e9b68cb-9457-4ad2-a6ab-af4806759e7a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RecordFieldEditorPanel.tsx:88',message:'RENDER',data:{renderCount:renderCountRef.current,recordId,fieldLayoutLength:fieldLayout.length,localFieldLayoutLength:localFieldLayout.length},timestamp:Date.now(),hypothesisId:'ALL'})}).catch(()=>{});
    }
  }
  // #endregion

  // Helper to get the visibility property value based on mode
  // Returns true if visible, false if hidden, undefined if not set (treat as visible)
  const getVisibilityProp = (layout: FieldLayoutItem): boolean | undefined => {
    if (mode === 'modal') {
      return layout.visible_in_modal
    } else {
      return layout.visible_in_canvas
    }
  }

  // Check if a field should be visible (treats undefined as visible)
  const isFieldVisible = (layout: FieldLayoutItem): boolean => {
    const visibility = getVisibilityProp(layout)
    // undefined means not explicitly set, so default to visible
    return visibility !== false
  }

  // Helper to set the visibility property based on mode
  const setVisibilityProp = (layout: FieldLayoutItem, visible: boolean): FieldLayoutItem => {
    if (mode === 'modal') {
      return { ...layout, visible_in_modal: visible }
    } else {
      return { ...layout, visible_in_canvas: visible }
    }
  }

  // CRITICAL FIX: Sync local layout with prop changes, but prevent loops
  // Use ref to track if update came from internal change (onFieldLayoutChange)
  const isInternalUpdateRef = useRef(false)
  const prevFieldLayoutRef = useRef<FieldLayoutItem[]>(fieldLayout)
  
  useEffect(() => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/7e9b68cb-9457-4ad2-a6ab-af4806759e7a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RecordFieldEditorPanel.tsx:123',message:'Sync effect RUN',data:{fieldLayoutLength:fieldLayout.length,localFieldLayoutLength:localFieldLayout.length,isInternalUpdate:isInternalUpdateRef.current,areEqual:JSON.stringify(fieldLayout)===JSON.stringify(localFieldLayout)},timestamp:Date.now(),hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    
    // CRITICAL: Skip sync if the update came from our own onFieldLayoutChange
    // This prevents: onFieldLayoutChange → parent updates fieldLayout prop → sync effect → loop
    if (isInternalUpdateRef.current) {
      isInternalUpdateRef.current = false
      prevFieldLayoutRef.current = fieldLayout
      return
    }
    
    // Only update if prop actually changed (not just reference)
    if (JSON.stringify(fieldLayout) !== JSON.stringify(prevFieldLayoutRef.current)) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/7e9b68cb-9457-4ad2-a6ab-af4806759e7a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RecordFieldEditorPanel.tsx:135',message:'Sync effect UPDATING localFieldLayout from prop',data:{fieldLayoutLength:fieldLayout.length},timestamp:Date.now(),hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      setLocalFieldLayout(fieldLayout)
      prevFieldLayoutRef.current = fieldLayout
    }
  }, [fieldLayout])

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
        
        const { data: table } = await supabase
          .from("tables")
          .select("supabase_table")
          .eq("id", tableId)
          .single()

        if (!table) {
          setLoading(false)
          return
        }

        const { data, error } = await supabase
          .from(table.supabase_table)
          .select("*")
          .eq("id", recordId)
          .single()

        if (error) {
          if (!isAbortError(error)) {
            throw error
          }
          return
        }

        setRecordData(data || {})
      } catch (error: any) {
        if (isAbortError(error)) {
          return
        }
        
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

  // Normalize update value for linked fields
  function normalizeUpdateValue(fieldName: string, value: any): any {
    const v: any = value === undefined ? null : value
    const field = allFields.find((f) => f?.name === fieldName)
    if (!field || field.type !== "link_to_table") return v

    const toId = (x: any): string | null => {
      if (x == null || x === "") return null
      if (typeof x === "string") return x
      if (typeof x === "object" && x && "id" in x) return String((x as any).id)
      return String(x)
    }

    const relationshipType = (field.options as any)?.relationship_type as
      | "one-to-one"
      | "one-to-many"
      | "many-to-many"
      | undefined
    const maxSelections = (field.options as any)?.max_selections as number | undefined
    const isMulti =
      relationshipType === "one-to-many" ||
      relationshipType === "many-to-many" ||
      (typeof maxSelections === "number" && maxSelections > 1)

    if (isMulti) {
      if (v == null) return null
      if (Array.isArray(v)) return v.map(toId).filter(Boolean)
      const id = toId(v)
      return id ? [id] : null
    }

    if (Array.isArray(v)) return toId(v[0])
    return toId(v)
  }

  // Handle field value change
  const handleFieldChange = useCallback(
    async (fieldName: string, value: any) => {
      if (!recordId || !tableId) return

      try {
        const supabase = createClient()
        const oldValue = recordData[fieldName] as string | string[] | null
        const normalizedValue = normalizeUpdateValue(fieldName, value)

        const { data: table } = await supabase
          .from("tables")
          .select("supabase_table")
          .eq("id", tableId)
          .single()

        if (!table) return

        const doUpdate = async (val: any) => {
          return await supabase.from(table.supabase_table).update({ [fieldName]: val }).eq("id", recordId)
        }

        let { error } = await doUpdate(normalizedValue)

        // Handle uuid[] column type mismatches
        if (
          error?.code === '42804' &&
          !Array.isArray(normalizedValue) &&
          String(error?.message || '').toLowerCase().includes('uuid[]')
        ) {
          const wrappedValue = normalizedValue != null ? [normalizedValue] : null
          const retry = await doUpdate(wrappedValue)
          error = retry.error
        }

        if (error) throw error

        // Sync bidirectional linked fields
        const field = allFields.find((f) => f?.name === fieldName)
        if (field && field.type === 'link_to_table') {
          try {
            await syncLinkedFieldBidirectional(
              tableId,
              table.supabase_table,
              fieldName,
              recordId,
              normalizedValue as string | string[] | null,
              oldValue,
              false
            )
          } catch (syncError) {
            console.error('[RecordFieldEditorPanel] Bidirectional sync failed:', syncError)
          }
        }

        setRecordData((prev) => ({ ...prev, [fieldName]: normalizedValue }))
        onFieldChange?.(fieldName, normalizedValue)
      } catch (error: any) {
        console.error("Error updating field:", error)
        toast({
          title: "Failed to update field",
          description: error.message || "Please try again",
          variant: "destructive",
        })
      }
    },
    [recordId, tableId, onFieldChange, toast, recordData, allFields]
  )

  // Handle linked record click
  const handleLinkedRecordClick = useCallback(
    async (linkedTableId: string, linkedRecordId: string) => {
      if (linkedTableId === tableId && linkedRecordId === recordId) {
        return
      }
      openRecordByTableId(linkedTableId, linkedRecordId)
    },
    [openRecordByTableId, tableId, recordId]
  )

  // Handle add linked record
  const handleAddLinkedRecord = useCallback((field: TableField) => {
    toast({
      title: "Add linked record",
      description: "This feature will open a record picker.",
    })
  }, [toast])

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Get visible fields from layout, filtered by search
  const visibleFields = useMemo(() => {
    // If no fields provided, return empty
    if (!allFields || allFields.length === 0) {
      return []
    }

    const layoutMap = new Map<string, FieldLayoutItem>()
    localFieldLayout.forEach((item) => {
      layoutMap.set(item.field_name, item)
    })

    // Get all fields, prioritizing layout order
    // If a field exists in layout, use it; otherwise create a default visible layout
    const orderedFields = allFields
      .map((field) => {
        const layout = layoutMap.get(field.name)
        if (layout) {
          // Field exists in layout - use it
          return { field, layout }
        } else {
          // Field not in layout - create default visible layout
          const defaultLayout: FieldLayoutItem = {
            field_id: field.id,
            field_name: field.name,
            order: allFields.length + allFields.indexOf(field),
            editable: pageEditable,
          }
          if (mode === 'modal') {
            defaultLayout.visible_in_modal = true
          } else {
            defaultLayout.visible_in_canvas = true
          }
          return { field, layout: defaultLayout }
        }
      })
      .filter(({ layout }) => isFieldVisible(layout))
      .sort((a, b) => a.layout.order - b.layout.order)

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      return orderedFields.filter(({ field }) =>
        getFieldDisplayName(field).toLowerCase().includes(query) ||
        field.name.toLowerCase().includes(query) ||
        field.type.toLowerCase().includes(query)
      )
    }

    return orderedFields
  }, [allFields, localFieldLayout, searchQuery, pageEditable, mode])

  // Handle drag end
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = visibleFields.findIndex(({ field }) => field.id === active.id)
      const newIndex = visibleFields.findIndex(({ field }) => field.id === over.id)

      if (oldIndex !== -1 && newIndex !== -1) {
        const reordered = arrayMove(visibleFields, oldIndex, newIndex)
        
        // Update layout with new orders
        const updatedLayout = reordered.map(({ layout }, index) => ({
          ...layout,
          order: index,
        }))

        // Merge with hidden fields
        const hiddenFields = localFieldLayout.filter(
          (item) => !visibleFields.some(({ field }) => field.name === item.field_name)
        )
        const allUpdated = [...updatedLayout, ...hiddenFields]

        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/7e9b68cb-9457-4ad2-a6ab-af4806759e7a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RecordFieldEditorPanel.tsx:390',message:'handleDragEnd calling onFieldLayoutChange',data:{allUpdatedLength:allUpdated.length},timestamp:Date.now(),hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        // CRITICAL: Mark as internal update to prevent sync effect from overwriting
        isInternalUpdateRef.current = true
        setLocalFieldLayout(allUpdated)
        prevFieldLayoutRef.current = allUpdated
        onFieldLayoutChange?.(allUpdated)
      }
    }
  }

  // Handle field visibility toggle
  const handleVisibilityToggle = (fieldName: string, visible: boolean) => {
    const updated = localFieldLayout.map((item) =>
      item.field_name === fieldName
        ? setVisibilityProp(item, visible)
        : item
    )

    // If field not in layout, add it
    if (!updated.some((item) => item.field_name === fieldName)) {
      const field = allFields.find((f) => f.name === fieldName)
      if (field) {
        const newItem: FieldLayoutItem = {
          field_id: field.id,
          field_name: field.name,
          order: Math.max(...updated.map((i) => i.order), -1) + 1,
          editable: pageEditable,
        }
        updated.push(setVisibilityProp(newItem, visible))
      }
    }

    // CRITICAL: Mark as internal update to prevent sync effect from overwriting
    isInternalUpdateRef.current = true
    setLocalFieldLayout(updated)
    prevFieldLayoutRef.current = updated
    onFieldLayoutChange?.(updated)
  }

  // Handle field editability toggle
  const handleEditableToggle = (fieldName: string, editable: boolean) => {
    const updated = localFieldLayout.map((item) =>
      item.field_name === fieldName ? { ...item, editable } : item
    )

    // If field not in layout, add it
    if (!updated.some((item) => item.field_name === fieldName)) {
      const field = allFields.find((f) => f.name === fieldName)
      if (field) {
        const existingVisible = visibleFields.find(({ field: f }) => f.name === fieldName)
        const newItem: FieldLayoutItem = {
          field_id: field.id,
          field_name: field.name,
          order: existingVisible?.layout.order ?? Math.max(...updated.map((i) => i.order), -1) + 1,
          editable,
        }
        const existingVisibility = existingVisible ? getVisibilityProp(existingVisible.layout) : true
        updated.push(setVisibilityProp(newItem, existingVisibility !== false))
      }
    }

    // CRITICAL: Mark as internal update to prevent sync effect from overwriting
    isInternalUpdateRef.current = true
    setLocalFieldLayout(updated)
    prevFieldLayoutRef.current = updated
    onFieldLayoutChange?.(updated)
  }

  // Sortable field item component
  function SortableFieldItem({ field, layout }: { field: TableField; layout: FieldLayoutItem }) {
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

    const value = recordData[field.name]
    const isEditable = layout.editable && pageEditable && !field.options?.read_only && field.type !== "formula" && field.type !== "lookup"
    const isVisible = isFieldVisible(layout)

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
          "border border-gray-200 rounded-lg p-4 space-y-2",
          isDragging && "shadow-lg bg-white"
        )}
      >
        {/* Field Header */}
        <div className="flex items-center gap-2">
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600"
          >
            <GripVertical className="h-4 w-4" />
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
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => handleEditableToggle(field.name, !layout.editable)}
              className={cn(
                "p-1.5 rounded",
                isEditable
                  ? "text-blue-600 hover:bg-blue-50"
                  : "text-gray-400 hover:bg-gray-50"
              )}
              disabled={!pageEditable}
              title={layout.editable ? "Editable" : "View-only"}
            >
              {isEditable ? (
                <Edit2 className="h-4 w-4" />
              ) : (
                <Lock className="h-4 w-4" />
              )}
            </button>
            <button
              type="button"
              onClick={() => handleVisibilityToggle(field.name, !isVisible)}
              className={cn(
                "p-1.5 rounded",
                isVisible
                  ? "text-gray-600 hover:bg-gray-50"
                  : "text-gray-400 hover:bg-gray-50"
              )}
              title={isVisible ? "Visible" : "Hidden"}
            >
              {isVisible ? (
                <Eye className="h-4 w-4" />
              ) : (
                <EyeOff className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        {/* Field Value Editor */}
        {isVisible && (
          <div className="pt-2">
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
                showLabel={false}
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
                  showLabel={false}
                />
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

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
        <div className="text-center">
          <p className="text-sm text-gray-500 mb-2">Select a record to edit</p>
          <p className="text-xs text-gray-400">Choose a record from the list to view and edit its fields</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center gap-2 mb-3">
          <Search className="h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search fields..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8"
          />
        </div>
        <div className="text-xs text-gray-500">
          {visibleFields.length} field{visibleFields.length !== 1 ? 's' : ''} visible
        </div>
      </div>

      {/* Fields List */}
      <div className="flex-1 overflow-y-auto p-4">
        {visibleFields.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-gray-500">No fields found</p>
            {searchQuery && (
              <p className="text-xs text-gray-400 mt-1">Try a different search term</p>
            )}
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={visibleFields.map(({ field }) => field.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-3">
                {visibleFields.map(({ field, layout }) => (
                  <SortableFieldItem
                    key={field.id}
                    field={field}
                    layout={layout}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>
    </div>
  )
}
