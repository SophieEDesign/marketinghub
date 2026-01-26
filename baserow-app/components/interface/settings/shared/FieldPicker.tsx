"use client"

import { useState, useMemo } from "react"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
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
import { GripVertical, X, Plus, ChevronDown, ChevronRight } from "lucide-react"
import type { TableField } from "@/types/database"
import { getFieldDisplayName } from "@/lib/fields/display"
import { sectionAndSortFields } from "@/lib/fields/sectioning"
import { SelectGroup, SelectLabel, SelectSeparator } from "@/components/ui/select"

export type FieldPickerMode = "checkbox" | "dropdown" | "drag" | "full"

interface FieldPickerProps {
  selectedFields: string[]
  onChange: (fieldNames: string[]) => void
  fields: TableField[]
  mode?: FieldPickerMode
  allowDrag?: boolean
  maxFields?: number
  label?: string
  description?: string
  required?: boolean
  filterFields?: (field: TableField) => boolean
  showPasteList?: boolean // Show/hide the paste list section (default: true)
}

function SortableFieldItem({
  id,
  field,
  onRemove,
}: {
  id: string
  field: TableField
  onRemove: () => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 p-2 border rounded-md bg-white hover:bg-gray-50"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="flex-1 text-sm">{getFieldDisplayName(field)}</span>
      <button
        type="button"
        onClick={onRemove}
        className="text-gray-400 hover:text-gray-600"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

export default function FieldPicker({
  selectedFields,
  onChange,
  fields,
  mode = "checkbox",
  allowDrag = true,
  maxFields,
  label,
  description,
  required = false,
  filterFields,
  showPasteList = true,
}: FieldPickerProps) {
  const [search, setSearch] = useState("")
  const [sort, setSort] = useState<"position" | "name_asc" | "name_desc" | "type_asc">("position")
  const [pasteText, setPasteText] = useState("")
  const [pasteSummary, setPasteSummary] = useState<{ added: number; missing: number } | null>(null)
  const [addFieldValue, setAddFieldValue] = useState<string>("")
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set())

  // Filter fields if filterFields function provided
  const availableFields = useMemo(() => {
    let filtered = filterFields ? fields.filter(filterFields) : fields
    // For checkbox mode, exclude already selected
    if (mode === "checkbox") {
      filtered = filtered.filter(
        (f) => !selectedFields.includes(f.name) && !selectedFields.includes(f.id)
      )
    }
    return filtered
  }, [fields, filterFields, mode, selectedFields])

  // Section fields by group_name for dropdown, drag, and checkbox modes
  const sectionedFields = useMemo(() => {
    return sectionAndSortFields(availableFields)
  }, [availableFields])

  // Toggle section collapse (for checkbox mode)
  const toggleSection = (sectionName: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev)
      if (next.has(sectionName)) {
        next.delete(sectionName)
      } else {
        next.add(sectionName)
      }
      return next
    })
  }

  // Handle adding all fields from a section (for checkbox mode)
  const handleAddAllFromSectionCheckbox = (sectionFields: TableField[]) => {
    const currentFields = selectedFields || []
    const newFields = sectionFields
      .filter((field) => {
        return !currentFields.includes(field.name) && !currentFields.includes(field.id)
      })
      .map((field) => field.name)
    
    if (newFields.length > 0) {
      onChange([...currentFields, ...newFields])
    }
  }

  // Get selected field objects
  const selectedFieldObjects = useMemo(() => {
    return selectedFields
      .map((fieldName) => {
        const field = fields.find((f) => f.name === fieldName || f.id === fieldName)
        return field ? { key: fieldName, field } : null
      })
      .filter((item): item is { key: string; field: TableField } => item !== null)
  }, [selectedFields, fields])

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

    const currentFields = selectedFields || []
    const oldIndex = currentFields.indexOf(active.id as string)
    const newIndex = currentFields.indexOf(over.id as string)

    if (oldIndex !== -1 && newIndex !== -1) {
      const newFields = arrayMove(currentFields, oldIndex, newIndex)
      onChange(newFields)
    }
  }

  // Handle adding a field
  const handleAddField = (fieldName: string) => {
    const currentFields = selectedFields || []
    const field = fields.find((f) => f.name === fieldName || f.id === fieldName)
    if (field && !currentFields.includes(field.name) && !currentFields.includes(field.id)) {
      if (maxFields && currentFields.length >= maxFields) return
      onChange([...currentFields, field.name])
      setAddFieldValue("")
    }
  }

  // Handle adding all fields from a section
  const handleAddAllFromSection = (sectionFields: TableField[]) => {
    const currentFields = selectedFields || []
    const newFields = sectionFields
      .filter((field) => {
        return !currentFields.includes(field.name) && !currentFields.includes(field.id)
      })
      .map((field) => field.name)
    
    if (newFields.length > 0) {
      if (maxFields) {
        const remaining = maxFields - currentFields.length
        if (remaining > 0) {
          onChange([...currentFields, ...newFields.slice(0, remaining)])
        }
      } else {
        onChange([...currentFields, ...newFields])
      }
    }
  }

  // Handle removing a field
  const handleRemoveField = (fieldKey: string) => {
    const currentFields = selectedFields || []
    const field = fields.find((f) => f.name === fieldKey || f.id === fieldKey)
    const keysToRemove = new Set<string>([fieldKey])
    if (field) {
      keysToRemove.add(field.name)
      keysToRemove.add(field.id)
    }
    onChange(currentFields.filter((f: string) => !keysToRemove.has(f)))
  }

  // For full mode: paste functionality
  const normalizeToken = (value: string) =>
    (value || "")
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase()

  const parsePasteList = (value: string) => {
    const raw = (value || "")
      .split(/[\n\r\t,;]+/g)
      .map((s) => s.trim())
      .filter(Boolean)
    const seen = new Set<string>()
    const tokens: string[] = []
    for (const t of raw) {
      const n = normalizeToken(t)
      if (!n || seen.has(n)) continue
      seen.add(n)
      tokens.push(t)
    }
    return tokens
  }

  const applyPaste = (pasteMode: "add" | "replace") => {
    const tokens = parsePasteList(pasteText)
    if (tokens.length === 0) {
      setPasteSummary({ added: 0, missing: 0 })
      return
    }

    const fieldNameByNorm = new Map<string, string>()
    for (const f of fields) fieldNameByNorm.set(normalizeToken(f.name), f.name)

    const matched: string[] = []
    let missing = 0
    for (const t of tokens) {
      const match = fieldNameByNorm.get(normalizeToken(t))
      if (match) matched.push(match)
      else missing += 1
    }

    const current = selectedFields || []
    const next =
      pasteMode === "replace"
        ? Array.from(new Set(matched))
        : Array.from(new Set([...current, ...matched]))
    const addedCount =
      pasteMode === "replace"
        ? next.length
        : next.filter((n) => !current.includes(n)).length

    onChange(next)
    setPasteSummary({ added: addedCount, missing })
  }

  // Display fields with search and sort
  const displayFields = useMemo(() => {
    const s = search.trim().toLowerCase()
    const base = s ? availableFields.filter((f) => f.name.toLowerCase().includes(s)) : availableFields
    if (sort === "position") return base
    const sorted = [...base]
    sorted.sort((a, b) => {
      if (sort === "name_asc") return a.name.localeCompare(b.name)
      if (sort === "name_desc") return b.name.localeCompare(a.name)
      if (sort === "type_asc")
        return (a.type || "").localeCompare(b.type || "") || a.name.localeCompare(b.name)
      return 0
    })
    return sorted
  }, [availableFields, search, sort])

  // Checkbox mode
  if (mode === "checkbox") {
    return (
      <div className="space-y-2">
        {label && (
          <div className="flex items-center justify-between">
            <Label>
              {label} {required && <span className="text-red-500">*</span>}
            </Label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  const allFieldNames = fields.map((f) => f.name)
                  onChange(allFieldNames)
                }}
                className="text-xs text-blue-600 hover:text-blue-700 underline"
              >
                Select All
              </button>
              <span className="text-xs text-gray-300">|</span>
              <button
                type="button"
                onClick={() => onChange([])}
                className="text-xs text-blue-600 hover:text-blue-700 underline"
              >
                Select None
              </button>
            </div>
          </div>
        )}
        {description && <p className="text-xs text-gray-500">{description}</p>}
        <div className="space-y-2 max-h-48 overflow-y-auto border rounded p-2">
          {sectionedFields.length === 0 ? (
            <div className="text-sm text-gray-500 text-center py-2">No fields available</div>
          ) : (
            sectionedFields.map(([sectionName, sectionFields]) => {
              const isCollapsed = collapsedSections.has(sectionName)
              
              return (
                <div key={sectionName} className="space-y-1">
                  <button
                    type="button"
                    onClick={() => toggleSection(sectionName)}
                    className="w-full flex items-center justify-between text-left py-1 px-2 rounded-md hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30"
                    aria-expanded={!isCollapsed}
                    aria-label={`${isCollapsed ? "Expand" : "Collapse"} ${sectionName} section`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-gray-700">{sectionName}</span>
                      <span className="text-xs text-gray-500">({sectionFields.length})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {sectionFields.length > 1 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleAddAllFromSectionCheckbox(sectionFields)
                          }}
                          className="text-xs text-blue-600 hover:text-blue-700 underline flex items-center gap-1"
                          title={`Add all ${sectionFields.length} fields from ${sectionName}`}
                        >
                          <Plus className="h-3 w-3" />
                          Add All
                        </button>
                      )}
                      <span className="text-gray-400">
                        {isCollapsed ? (
                          <ChevronRight className="h-3 w-3" />
                        ) : (
                          <ChevronDown className="h-3 w-3" />
                        )}
                      </span>
                    </div>
                  </button>
                  {!isCollapsed && (
                    <div className="space-y-1 pl-4">
                      {sectionFields.map((field) => {
                        const isSelected =
                          selectedFields.includes(field.name) || selectedFields.includes(field.id)
                        return (
                          <label
                            key={field.id || field.name}
                            className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded transition-colors"
                          >
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  if (!selectedFields.includes(field.name) && !selectedFields.includes(field.id)) {
                                    onChange([...selectedFields, field.name])
                                  }
                                } else {
                                  onChange(
                                    selectedFields.filter(
                                      (f: string) => f !== field.name && f !== field.id
                                    )
                                  )
                                }
                              }}
                            />
                            <span className="text-sm flex-1">{getFieldDisplayName(field)}</span>
                            <span className="text-xs text-gray-400 capitalize">
                              {(field.type || "").replace("_", " ")}
                            </span>
                          </label>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
    )
  }

  // Dropdown mode
  if (mode === "dropdown") {
    return (
      <div className="space-y-2">
        {label && <Label>{label}</Label>}
        {description && <p className="text-xs text-gray-500">{description}</p>}
        <Select
          value={addFieldValue}
          onValueChange={(value) => {
            if (value && !value.startsWith("__section__")) {
              handleAddField(value)
            }
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a field..." />
          </SelectTrigger>
          <SelectContent>
            {sectionedFields && sectionedFields.length > 0 ? (
              sectionedFields.map(([sectionName, sectionFields]: [string, TableField[]], sectionIndex: number) => (
                <SelectGroup key={sectionName}>
                  <div className="flex items-center justify-between px-2 py-1.5">
                    <SelectLabel className="text-xs font-semibold text-gray-700">
                      {sectionName}
                    </SelectLabel>
                    {sectionFields.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleAddAllFromSection(sectionFields)
                        }}
                        className="text-xs text-blue-600 hover:text-blue-700 underline flex items-center gap-1"
                        title={`Add all ${sectionFields.length} fields from ${sectionName}`}
                      >
                        <Plus className="h-3 w-3" />
                        Add All
                      </button>
                    )}
                  </div>
                  {sectionFields.map((field: TableField) => (
                    <SelectItem key={field.id} value={field.name}>
                      {getFieldDisplayName(field)}
                    </SelectItem>
                  ))}
                  {sectionIndex < sectionedFields.length - 1 && (
                    <SelectSeparator />
                  )}
                </SelectGroup>
              ))
            ) : (
              availableFields.map((field) => (
                <SelectItem key={field.id} value={field.name}>
                  {getFieldDisplayName(field)}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>
    )
  }

  // Drag mode
  if (mode === "drag") {
    return (
      <div className="space-y-2">
        {label && (
          <div className="flex items-center justify-between">
            <Label>{label}</Label>
            {availableFields.length > 0 && (
              <Select value={addFieldValue} onValueChange={(value) => {
                if (value && !value.startsWith("__section__")) {
                  handleAddField(value)
                }
              }}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Add field" />
                </SelectTrigger>
                <SelectContent>
                  {sectionedFields && sectionedFields.length > 0 ? (
                    sectionedFields.map(([sectionName, sectionFields]: [string, TableField[]], sectionIndex: number) => (
                      <SelectGroup key={sectionName}>
                        <div className="flex items-center justify-between px-2 py-1.5">
                          <SelectLabel className="text-xs font-semibold text-gray-700">
                            {sectionName}
                          </SelectLabel>
                          {sectionFields.length > 1 && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleAddAllFromSection(sectionFields)
                              }}
                              className="text-xs text-blue-600 hover:text-blue-700 underline flex items-center gap-1"
                              title={`Add all ${sectionFields.length} fields from ${sectionName}`}
                            >
                              <Plus className="h-3 w-3" />
                              Add All
                            </button>
                          )}
                        </div>
                        {sectionFields.map((field: TableField) => (
                          <SelectItem key={field.id} value={field.name}>
                            {getFieldDisplayName(field)}
                          </SelectItem>
                        ))}
                        {sectionIndex < sectionedFields.length - 1 && (
                          <SelectSeparator />
                        )}
                      </SelectGroup>
                    ))
                  ) : (
                    availableFields.map((field) => (
                      <SelectItem key={field.id} value={field.name}>
                        {getFieldDisplayName(field)}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            )}
          </div>
        )}
        {description && <p className="text-xs text-gray-500">{description}</p>}
        {selectedFieldObjects.length === 0 ? (
          <div className="text-sm text-gray-500 text-center py-4 border rounded">
            No fields added. Select fields from the dropdown above.
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={selectedFieldObjects.map((item) => item.key)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {selectedFieldObjects.map(({ field, key }) => (
                  <SortableFieldItem
                    key={key}
                    id={key}
                    field={field}
                    onRemove={() => handleRemoveField(key)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>
    )
  }

  // Full mode (with search, sort, paste, drag)
  return (
    <div className="space-y-3 pt-2 border-t border-gray-200">
      {label && (
        <div className="flex items-center justify-between">
          <Label className="text-sm font-semibold">{label}</Label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onChange(fields.map((f) => f.name))}
              className="text-xs text-blue-600 hover:text-blue-700 underline"
            >
              Select All
            </button>
            <span className="text-xs text-gray-300">|</span>
            <button
              type="button"
              onClick={() => onChange([])}
              className="text-xs text-blue-600 hover:text-blue-700 underline"
            >
              Select None
            </button>
            <span className="text-xs text-gray-300">|</span>
            <button
              type="button"
              onClick={() => {
                const selected = new Set(selectedFields || [])
                onChange(
                  fields.filter((f) => !selected.has(f.name)).map((f) => f.name)
                )
              }}
              className="text-xs text-blue-600 hover:text-blue-700 underline"
            >
              Invert
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs text-gray-600">Search</Label>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search fields..."
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-gray-600">Sort</Label>
          <Select value={sort} onValueChange={(v) => setSort(v as any)}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="position">Default (table order)</SelectItem>
              <SelectItem value="name_asc">Name (A → Z)</SelectItem>
              <SelectItem value="name_desc">Name (Z → A)</SelectItem>
              <SelectItem value="type_asc">Type (A → Z)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {showPasteList && (
        <div className="space-y-2">
          <Label className="text-xs text-gray-600">Paste list (field names)</Label>
          <Textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder={"Paste field names (one per line, or comma-separated)"}
            className="text-xs min-h-[70px]"
          />
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => applyPaste("add")}
            >
              Add
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => applyPaste("replace")}
            >
              Replace
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs ml-auto"
              onClick={() => {
                setPasteText("")
                setPasteSummary(null)
              }}
            >
              Clear
            </Button>
          </div>
          {pasteSummary && (
            <div className="text-xs text-gray-500">
              Added: {pasteSummary.added} · Not found: {pasteSummary.missing}
            </div>
          )}
        </div>
      )}

      <div className="border rounded-md p-3 max-h-[200px] overflow-y-auto space-y-2 bg-gray-50">
        {displayFields.map((field) => {
          const currentFields = selectedFields || []
          const isVisible =
            currentFields.includes(field.name) || currentFields.includes(field.id)
          return (
            <label
              key={field.id || field.name}
              className="flex items-center gap-2 cursor-pointer hover:bg-white p-2 rounded transition-colors"
            >
              <Checkbox
                checked={isVisible}
                onCheckedChange={(checked) => {
                  if (checked) {
                    if (
                      !currentFields.includes(field.name) &&
                      !currentFields.includes(field.id)
                    ) {
                      onChange([...currentFields, field.name])
                    }
                  } else {
                    onChange(
                      currentFields.filter(
                        (f: string) => f !== field.name && f !== field.id
                      )
                    )
                  }
                }}
              />
              <span className="text-sm flex-1">{getFieldDisplayName(field)}</span>
              <span className="text-xs text-gray-400 capitalize">
                {(field.type || "").replace("_", " ")}
              </span>
            </label>
          )
        })}
      </div>
    </div>
  )
}
