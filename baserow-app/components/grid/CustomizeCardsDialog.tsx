"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical, Search, ImageIcon, Layers } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { supabase } from "@/lib/supabase/client"
import type { TableField } from "@/types/fields"
import { FIELD_TYPES } from "@/types/fields"
import { normalizeUuid } from "@/lib/utils/ids"

function SortableCardFieldRow({
  field,
  isVisible,
  onToggle,
}: {
  field: TableField
  isVisible: boolean
  onToggle: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: field.name,
  })
  const style = { transform: CSS.Transform.toString(transform), transition }
  const typeLabel = FIELD_TYPES.find((t) => t.type === field.type)?.label ?? field.type
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 p-2 hover:bg-gray-50 rounded ${isDragging ? "opacity-50" : ""}`}
    >
      <button
        type="button"
        className="cursor-grab touch-none p-0.5 text-gray-400 hover:text-gray-600"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <Switch
        id={`card-${field.name}`}
        checked={isVisible}
        onCheckedChange={onToggle}
      />
      <Label
        htmlFor={`card-${field.name}`}
        className="flex-1 text-sm font-medium text-gray-700 cursor-pointer"
      >
        {field.label || field.name}
      </Label>
      <span className="text-xs text-gray-500">{typeLabel}</span>
    </div>
  )
}

export interface CardConfig {
  cardFields: string[]
  cardImageField?: string
  cardColorField?: string
  cardWrapText?: boolean
  groupBy?: string
}

interface CustomizeCardsDialogProps {
  isOpen: boolean
  onClose: () => void
  viewId: string
  tableId: string
  tableFields: TableField[]
  /** Visible view fields (from view_fields) - used as base for card fields */
  viewFields: Array<{ field_name: string; visible: boolean; position: number }>
  config: CardConfig
  onConfigChange: (config: CardConfig) => void
}

const IMAGE_FIELD_TYPES = ["attachment", "url"]

export default function CustomizeCardsDialog({
  isOpen,
  onClose,
  viewId,
  tableId,
  tableFields,
  viewFields,
  config,
  onConfigChange,
}: CustomizeCardsDialogProps) {
  const router = useRouter()
  const viewUuid = normalizeUuid(viewId)
  const [localCardFields, setLocalCardFields] = useState<string[]>(config.cardFields)
  const [localImageField, setLocalImageField] = useState<string>(config.cardImageField || "")
  const [localColorField, setLocalColorField] = useState<string>(config.cardColorField || "")
  const [localWrapText, setLocalWrapText] = useState(config.cardWrapText ?? true)
  const [localGroupBy, setLocalGroupBy] = useState<string>(config.groupBy || "")
  const [orderedFieldNames, setOrderedFieldNames] = useState<string[]>([])
  const [search, setSearch] = useState("")

  useEffect(() => {
    setLocalCardFields(config.cardFields)
    setLocalImageField(config.cardImageField || "")
    setLocalColorField(config.cardColorField || "")
    setLocalWrapText(config.cardWrapText ?? true)
    setLocalGroupBy(config.groupBy || "")
  }, [config, isOpen])

  useEffect(() => {
    if (isOpen) {
      const visibleOrder = [...viewFields]
        .sort((a, b) => a.position - b.position)
        .filter((vf) => vf.visible)
        .map((vf) => vf.field_name)
      if (visibleOrder.length > 0) {
        if (config.cardFields.length > 0) {
          const cardSet = new Set(config.cardFields)
          const ordered = config.cardFields.filter((n) => visibleOrder.includes(n))
          const rest = visibleOrder.filter((n) => !cardSet.has(n))
          setOrderedFieldNames([...ordered, ...rest])
        } else {
          setOrderedFieldNames(visibleOrder)
        }
      } else {
        setOrderedFieldNames(tableFields.map((f) => f.name))
      }
    }
  }, [isOpen, viewFields, config.cardFields, tableFields])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setOrderedFieldNames((prev) => {
      const oldIndex = prev.indexOf(String(active.id))
      const newIndex = prev.indexOf(String(over.id))
      if (oldIndex === -1 || newIndex === -1) return prev
      const next = [...prev]
      const [removed] = next.splice(oldIndex, 1)
      next.splice(newIndex, 0, removed)
      return next
    })
  }

  function toggleField(fieldName: string) {
    if (localCardFields.includes(fieldName)) {
      setLocalCardFields(localCardFields.filter((f) => f !== fieldName))
    } else {
      setLocalCardFields([...localCardFields, fieldName])
    }
  }

  const hideAll = () => setLocalCardFields([])
  const showAll = () => {
    const visible = hasViewFields
      ? viewFields.filter((vf) => vf.visible).map((vf) => vf.field_name)
      : tableFields.map((f) => f.name)
    setLocalCardFields(visible)
  }

  const visibleViewFieldNames = viewFields.filter((vf) => vf.visible).map((vf) => vf.field_name)
  const hasViewFields = visibleViewFieldNames.length > 0
  const displayFields = (() => {
    const s = search.trim().toLowerCase()
    let base: TableField[]
    if (orderedFieldNames.length > 0 && hasViewFields) {
      base = orderedFieldNames
        .filter((name) => visibleViewFieldNames.includes(name))
        .map((name) => tableFields.find((f) => f.name === name))
        .filter(Boolean) as TableField[]
    } else if (hasViewFields) {
      base = tableFields.filter((f) => visibleViewFieldNames.includes(f.name))
    } else {
      base = [...tableFields]
    }
    if (s) {
      return base.filter(
        (f) =>
          (f.label || f.name).toLowerCase().includes(s) ||
          f.name.toLowerCase().includes(s)
      )
    }
    return base
  })()

  const imageFields = tableFields.filter((f) => IMAGE_FIELD_TYPES.includes(f.type))
  const colorFields = tableFields.filter(
    (f) => f.type === "single_select" || f.type === "multi_select"
  )
  const groupFields = tableFields.filter(
    (f) =>
      f.type === "single_select" ||
      f.type === "multi_select" ||
      f.type === "text" ||
      f.type === "long_text"
  )

  async function handleSave() {
    const nextCardFields = orderedFieldNames.filter((name) => localCardFields.includes(name))
    const nextConfig: CardConfig = {
      cardFields: nextCardFields,
      cardImageField: localImageField || undefined,
      cardColorField: localColorField || undefined,
      cardWrapText: localWrapText,
      groupBy: localGroupBy || undefined,
    }
    onConfigChange(nextConfig)

    try {
      if (!viewUuid) return
      const { data: viewData } = await supabase
        .from("views")
        .select("config")
        .eq("id", viewUuid)
        .single()
      const currentConfig = (viewData?.config as Record<string, unknown>) || {}
      await supabase
        .from("views")
        .update({
          config: {
            ...currentConfig,
            card_fields: nextCardFields,
            card_image_field: nextConfig.cardImageField,
            card_color_field: nextConfig.cardColorField,
            card_wrap_text: nextConfig.cardWrapText,
            kanbanGroupField: nextConfig.groupBy,
          },
        })
        .eq("id", viewUuid)

      if (localGroupBy && localGroupBy !== config.groupBy) {
        const { data: gvs } = await supabase
          .from("grid_view_settings")
          .select("id")
          .eq("view_id", viewUuid)
          .maybeSingle()
        if (gvs?.id) {
          await supabase
            .from("grid_view_settings")
            .update({ group_by_field: localGroupBy })
            .eq("view_id", viewUuid)
        } else {
          await supabase.from("grid_view_settings").insert({
            view_id: viewUuid,
            group_by_field: localGroupBy,
          })
        }
      }
      router.refresh()
    } catch (error) {
      console.error("Error saving card config:", error)
    }
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Customize cards</DialogTitle>
          <DialogDescription>
            Choose which fields appear on each card and how they are displayed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 overflow-y-auto flex-1 min-h-0">
          {/* Stacked by (group field) */}
          {groupFields.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs font-medium flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5" />
                Stacked by
              </Label>
              <Select value={localGroupBy || "__none__"} onValueChange={(v) => setLocalGroupBy(v === "__none__" ? "" : v)}>
                <SelectTrigger className="h-8">
                  <SelectValue placeholder="Select field" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {groupFields.map((f) => (
                    <SelectItem key={f.name} value={f.name}>
                      {f.label || f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Image field */}
          {imageFields.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs font-medium flex items-center gap-1.5">
                <ImageIcon className="h-3.5 w-3.5" />
                Image field
              </Label>
              <Select value={localImageField || "__none__"} onValueChange={(v) => setLocalImageField(v === "__none__" ? "" : v)}>
                <SelectTrigger className="h-8">
                  <SelectValue placeholder="Choose image field" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {imageFields.map((f) => (
                    <SelectItem key={f.name} value={f.name}>
                      {f.label || f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Color field */}
          {colorFields.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs font-medium">Color</Label>
              <Select value={localColorField || "__none__"} onValueChange={(v) => setLocalColorField(v === "__none__" ? "" : v)}>
                <SelectTrigger className="h-8">
                  <SelectValue placeholder="Choose color field" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {colorFields.map((f) => (
                    <SelectItem key={f.name} value={f.name}>
                      {f.label || f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Find a field */}
          <div className="space-y-2">
            <Label className="text-xs font-medium">Fields on card</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <Input
                type="text"
                placeholder="Find a field"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 text-sm"
              />
            </div>
          </div>

          {/* Field list with toggles */}
          <div className="border rounded-lg overflow-hidden max-h-48 overflow-y-auto">
            {displayFields.length === 0 ? (
              <div className="p-4 text-sm text-gray-500 text-center">No fields match</div>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={displayFields.map((f) => f.name)} strategy={verticalListSortingStrategy}>
                  <div className="divide-y">
                    {displayFields.map((field) => (
                      <SortableCardFieldRow
                        key={field.name}
                        field={field}
                        isVisible={localCardFields.includes(field.name)}
                        onToggle={() => toggleField(field.name)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>

          {/* Hide all / Show all */}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={hideAll} className="text-xs">
              Hide all
            </Button>
            <Button variant="outline" size="sm" onClick={showAll} className="text-xs">
              Show all
            </Button>
          </div>

          <p className="text-xs text-gray-500">
            Only non-empty values are displayed in kanban cards.
          </p>

          {/* Wrap long cell values */}
          <div className="flex items-center justify-between">
            <Label htmlFor="wrap-text" className="text-sm">
              Wrap long cell values
            </Label>
            <Switch
              id="wrap-text"
              checked={localWrapText}
              onCheckedChange={setLocalWrapText}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
