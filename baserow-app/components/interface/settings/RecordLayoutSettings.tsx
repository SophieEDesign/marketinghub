"use client"

import { useState, useCallback, useEffect, useMemo } from "react"
import { useRecordPanel } from "@/contexts/RecordPanelContext"
import {
  GripVertical,
  Eye,
  EyeOff,
  Search,
  MessageSquare,
  MoreHorizontal,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import type { TableField } from "@/types/fields"
import type { FieldLayoutItem } from "@/lib/interface/field-layout-utils"
import { createInitialFieldLayout } from "@/lib/interface/field-layout-helpers"
import { getFieldDisplayName } from "@/lib/fields/display"
import { getFieldIcon } from "@/lib/icons"
import { getPrimaryFieldName } from "@/lib/fields/primary"
import { cn } from "@/lib/utils"

interface RecordLayoutSettingsProps {
  tableId: string
  recordId: string
  fieldLayout: FieldLayoutItem[]
  onLayoutSave:
    | ((layout: FieldLayoutItem[]) => void)
    | ((layout: FieldLayoutItem[]) => Promise<void>)
    | null
  fields: TableField[]
  /** When provided with onPageConfigSave, shows Data/Permissions/Appearance/User actions sections (record_view) */
  pageConfig?: Record<string, unknown>
  onPageConfigSave?: (updates: Record<string, unknown>) => Promise<void>
}

function SortableFieldRow({
  item,
  field,
  onVisibilityToggle,
  visible,
  searchQuery,
  isHiddenSection,
}: {
  item: FieldLayoutItem
  field: TableField
  onVisibilityToggle: (fieldName: string, visible: boolean) => void
  visible: boolean
  searchQuery: string
  isHiddenSection: boolean
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.field_id })

  const displayName = getFieldDisplayName(field)
  const matchesSearch =
    !searchQuery ||
    displayName.toLowerCase().includes(searchQuery.toLowerCase())

  if (!matchesSearch) return null

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 py-2 px-3 rounded-md border border-gray-200 bg-white",
        isHiddenSection && "opacity-60",
        isDragging && "shadow-md z-10"
      )}
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 p-1"
      >
        <GripVertical className="h-4 w-4" />
      </div>
      <div className="flex-shrink-0 text-gray-500">
        {getFieldIcon(field.type)}
      </div>
      <span
        className={cn(
          "flex-1 text-sm truncate",
          isHiddenSection ? "text-gray-400" : "font-medium text-gray-900"
        )}
      >
        {displayName}
      </span>
      <button
        type="button"
        onClick={() => onVisibilityToggle(field.name, !visible)}
        className="p-1 text-gray-400 hover:text-gray-600"
        title={visible ? "Hide field" : "Show field"}
      >
        {visible ? (
          <Eye className="h-4 w-4" />
        ) : (
          <EyeOff className="h-4 w-4" />
        )}
      </button>
      <button
        type="button"
        className="p-1 text-gray-400 hover:text-gray-600"
        title="More options"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
    </div>
  )
}

export default function RecordLayoutSettings({
  tableId,
  recordId,
  fieldLayout,
  onLayoutSave,
  fields,
  pageConfig,
  onPageConfigSave,
}: RecordLayoutSettingsProps) {
  const { setFieldLayout: setLiveLayout } = useRecordPanel()
  const resolvedLayout = useMemo(() => {
    const base =
      fieldLayout.length > 0
        ? fieldLayout
        : createInitialFieldLayout(fields, "record_review", true)
    const layoutNames = new Set(base.map((i) => i.field_name))
    const missing = fields.filter(
      (f) => !layoutNames.has(f.name) && !f.options?.system
    )
    if (missing.length === 0) return base
    const maxOrder = Math.max(...base.map((i) => i.order), -1)
    return [
      ...base,
      ...missing.map((f, i) => ({
        field_id: f.id,
        field_name: f.name,
        order: maxOrder + 1 + i,
        editable: true,
        visible_in_canvas: false,
        visible_in_modal: false,
      })),
    ]
  }, [fieldLayout, fields])

  const [draftLayout, setDraftLayout] = useState<FieldLayoutItem[]>(() => [
    ...resolvedLayout,
  ])
  const [searchQuery, setSearchQuery] = useState("")

  const layoutSignature = `${resolvedLayout.length}-${resolvedLayout.map((i) => i.field_id).sort().join(",")}`
  useEffect(() => {
    if (resolvedLayout.length > 0) {
      setDraftLayout([...resolvedLayout])
    }
  }, [layoutSignature, resolvedLayout])

  const fieldMap = useMemo(
    () => new Map(fields.map((f) => [f.name, f])),
    [fields]
  )

  const visibleItems = useMemo(() => {
    const sorted = [...draftLayout].sort((a, b) => a.order - b.order)
    return sorted.filter(
      (item) =>
        ((item as any).visible_in_canvas ?? (item as any).visible_in_modal) !==
        false
    )
  }, [draftLayout])

  const hiddenItems = useMemo(() => {
    const sorted = [...draftLayout].sort((a, b) => a.order - b.order)
    return sorted.filter(
      (item) =>
        ((item as any).visible_in_canvas ?? (item as any).visible_in_modal) ===
        false
    )
  }, [draftLayout])

  const handleVisibilityToggle = useCallback(
    (fieldName: string, visible: boolean) => {
      setDraftLayout((prev) => {
        const existing = prev.find(
          (i) => i.field_name === fieldName || i.field_id === fieldName
        )
        let next: FieldLayoutItem[]
        if (existing) {
          next = prev.map((i) =>
            i.field_name === fieldName || i.field_id === fieldName
              ? {
                  ...i,
                  visible_in_canvas: visible,
                  visible_in_modal: visible,
                }
              : i
          )
        } else {
          const field = fieldMap.get(fieldName)
          if (!field) return prev
          const newItem: FieldLayoutItem = {
            field_id: field.id,
            field_name: field.name,
            order: Math.max(...prev.map((i) => i.order), -1) + 1,
            editable: true,
            visible_in_canvas: visible,
            visible_in_modal: visible,
          }
          next = [...prev, newItem]
        }
        setLiveLayout(next)
        return next
      })
    },
    [fieldMap, setLiveLayout]
  )

  const handleHideAll = useCallback(() => {
    setDraftLayout((prev) => {
      const next = prev.map((i) => ({
        ...i,
        visible_in_canvas: false,
        visible_in_modal: false,
      }))
      setLiveLayout(next)
      return next
    })
  }, [setLiveLayout])

  const handleShowAll = useCallback(() => {
    setDraftLayout((prev) => {
      const next = prev.map((i) => ({
        ...i,
        visible_in_canvas: true,
        visible_in_modal: true,
      }))
      setLiveLayout(next)
      return next
    })
  }, [setLiveLayout])

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return

      setDraftLayout((prev) => {
        const ids = prev.map((i) => i.field_id)
        const oldIndex = ids.indexOf(active.id as string)
        const newIndex = ids.indexOf(over.id as string)
        if (oldIndex === -1 || newIndex === -1) return prev

        const reordered = [...prev]
        const [moved] = reordered.splice(oldIndex, 1)
        reordered.splice(newIndex, 0, moved)

        const next = reordered.map((item, index) => ({
          ...item,
          order: index,
        }))
        setLiveLayout(next)
        return next
      })
    },
    [setLiveLayout]
  )

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const hasPageConfig = Boolean(pageConfig && onPageConfigSave)
  const primaryFieldName = getPrimaryFieldName(fields) || (fields[0]?.name ?? "")
  const titleField = (pageConfig?.title_field as string) || primaryFieldName || ""
  const allowEditing = pageConfig?.allow_editing !== false
  const titleSize = (pageConfig?.title_size as "large" | "extra_large") || "large"
  const commentsEnabled = pageConfig?.comments_enabled !== false
  const revisionHistoryEnabled = pageConfig?.revision_history_enabled === true

  const handlePageConfigUpdate = useCallback(
    (updates: Record<string, unknown>) => {
      onPageConfigSave?.(updates)
    },
    [onPageConfigSave]
  )

  return (
    <div className="flex flex-col h-full">
      {/* Data: Title field, Permissions, Appearance, User actions (record_view only) */}
      {hasPageConfig && (
        <div className="p-4 border-b border-gray-200 space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700">Title field</Label>
            <Select
              value={titleField}
              onValueChange={(v) => handlePageConfigUpdate({ title_field: v })}
            >
              <SelectTrigger className="bg-gray-50">
                <SelectValue placeholder="Primary field" />
              </SelectTrigger>
              <SelectContent>
                {fields
                  .filter((f) => !f.options?.system)
                  .map((f) => (
                    <SelectItem key={f.id} value={f.name}>
                      {getFieldDisplayName(f)}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700">Permissions</Label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handlePageConfigUpdate({ allow_editing: false })}
                className={cn(
                  "flex-1 py-2.5 px-4 rounded-md text-sm font-medium transition-colors",
                  !allowEditing
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                )}
              >
                View-only
              </button>
              <button
                type="button"
                onClick={() => handlePageConfigUpdate({ allow_editing: true })}
                className={cn(
                  "flex-1 py-2.5 px-4 rounded-md text-sm font-medium transition-colors",
                  allowEditing
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                )}
              >
                Editable
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700">Title size</Label>
            <Select
              value={titleSize}
              onValueChange={(v) => handlePageConfigUpdate({ title_size: v as "large" | "extra_large" })}
            >
              <SelectTrigger className="bg-gray-50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="large">Large</SelectItem>
                <SelectItem value="extra_large">Extra large</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="comments-enabled" className="text-sm font-medium text-gray-700">
                Comments
              </Label>
              <Switch
                id="comments-enabled"
                checked={commentsEnabled}
                onCheckedChange={(checked) => handlePageConfigUpdate({ comments_enabled: checked })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="revision-history" className="text-sm font-medium text-gray-700">
                Revision history
              </Label>
              <Switch
                id="revision-history"
                checked={revisionHistoryEnabled}
                onCheckedChange={(checked) => handlePageConfigUpdate({ revision_history_enabled: checked })}
              />
            </div>
          </div>
        </div>
      )}

      {/* Fields to show in record modal - single source for modal layout */}
      <div className="p-4 border-b border-gray-200">
        <p className="text-sm font-medium text-gray-700 mb-1">Fields to show in record modal</p>
        <p className="text-xs text-gray-500 mb-3">
          Choose which fields appear when opening a record. Drag to reorder. Use the eye icon to show or hide each field.
        </p>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search fields"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 bg-gray-50 border-gray-200"
          />
        </div>
      </div>

      {/* Visible & Hidden sections */}
      <div className="flex-1 overflow-y-auto min-h-0 p-4 space-y-4">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={draftLayout.map((i) => i.field_id)}
            strategy={verticalListSortingStrategy}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-700">Visible</p>
                {visibleItems.length > 0 && (
                  <button
                    type="button"
                    onClick={handleHideAll}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Hide all
                  </button>
                )}
              </div>

              {/* Record comments - special row */}
              {(!searchQuery ||
                "record comments".includes(searchQuery.toLowerCase())) && (
                <div className="flex items-center gap-2 py-2 px-3 rounded-md border border-gray-200 bg-white mb-2">
                  <div className="w-4 flex-shrink-0" />
                  <MessageSquare className="h-3.5 w-3.5 text-gray-500 flex-shrink-0" />
                  <span className="flex-1 text-sm font-medium text-gray-900">
                    Record comments
                  </span>
                </div>
              )}

              <div className="space-y-2">
                {visibleItems.map((item) => {
                  const field =
                    fieldMap.get(item.field_name) ||
                    fields.find((f) => f.id === item.field_id)
                  if (!field) return null
                  return (
                    <SortableFieldRow
                      key={item.field_id}
                      item={item}
                      field={field}
                      onVisibilityToggle={handleVisibilityToggle}
                      visible={true}
                      searchQuery={searchQuery}
                      isHiddenSection={false}
                    />
                  )
                })}
              </div>
            </div>

            {/* Hidden section */}
            {hiddenItems.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-gray-700">Hidden</p>
                  <button
                    type="button"
                    onClick={handleShowAll}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Show all
                  </button>
                </div>
                <div className="space-y-2">
                  {hiddenItems.map((item) => {
                    const field =
                      fieldMap.get(item.field_name) ||
                      fields.find((f) => f.id === item.field_id)
                    if (!field) return null
                    return (
                      <SortableFieldRow
                        key={item.field_id}
                        item={item}
                        field={field}
                        onVisibilityToggle={handleVisibilityToggle}
                        visible={false}
                        searchQuery={searchQuery}
                        isHiddenSection={true}
                      />
                    )
                  })}
                </div>
              </div>
            )}
          </SortableContext>
        </DndContext>
      </div>
    </div>
  )
}
