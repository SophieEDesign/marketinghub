"use client"

import { useState, useEffect, memo, useMemo } from "react"
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
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Plus, Edit, Trash2, Save, X, GripVertical } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { createClient } from "@/lib/supabase/client"
import { validateFieldOptions } from "@/lib/fields/validation"
import { getFieldDisplayName } from "@/lib/fields/display"
import type { TableField, FieldType, FieldOptions } from "@/types/fields"
import { FIELD_TYPES } from "@/types/fields"
import FormulaEditor from "@/components/fields/FormulaEditor"
import FieldSettingsDrawer from "./FieldSettingsDrawer"
import { getTableSections, reorderSections, upsertSectionSettings, ensureSectionExists } from "@/lib/core-data/section-settings"
import type { SectionSettings } from "@/lib/core-data/types"
import { ChevronUp, ChevronDown } from "lucide-react"

interface FieldBuilderPanelProps {
  tableId: string
  supabaseTableName: string
  onFieldsUpdated: () => void
}

const FieldBuilderPanel = memo(function FieldBuilderPanel({
  tableId,
  supabaseTableName,
  onFieldsUpdated,
}: FieldBuilderPanelProps) {
  const [fields, setFields] = useState<TableField[]>([])
  const [loading, setLoading] = useState(true)
  const [primaryFieldName, setPrimaryFieldName] = useState<string | null>(null)
  const [savingPrimary, setSavingPrimary] = useState(false)
  const [editingField, setEditingField] = useState<TableField | null>(null)
  const [showNewField, setShowNewField] = useState(false)
  const [settingsDrawerOpen, setSettingsDrawerOpen] = useState(false)
  const [sections, setSections] = useState<SectionSettings[]>([])
  const [loadingSections, setLoadingSections] = useState(false)
  const [reorderingSections, setReorderingSections] = useState(false)

  useEffect(() => {
    loadFields()
    loadTableSettings()
    loadSections()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableId])

  async function loadTableSettings() {
    try {
      const res = await fetch(`/api/tables/${tableId}`, { cache: "no-store" })
      const data = await res.json()
      if (res.ok && data?.table) {
        setPrimaryFieldName(data.table.primary_field_name ?? null)
      }
    } catch (error) {
      console.warn("Error loading table settings:", error)
    }
  }

  async function loadSections() {
    setLoadingSections(true)
    try {
      const loadedSections = await getTableSections(tableId)
      setSections(loadedSections)
    } catch (error) {
      console.error("Error loading sections:", error)
    } finally {
      setLoadingSections(false)
    }
  }

  async function handleReorderSections(sectionNameOrId: string, direction: 'up' | 'down') {
    if (reorderingSections) return
    
    const currentIndex = allSections.findIndex(s => s.id === sectionNameOrId || s.name === sectionNameOrId)
    if (currentIndex === -1) return
    
    const currentSection = allSections[currentIndex]
    
    // Don't allow reordering General section
    if (currentSection.name === 'General') return
    
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    if (newIndex < 0 || newIndex >= allSections.length) return
    
    // Don't allow moving past General section
    if (allSections[newIndex].name === 'General') return
    
    setReorderingSections(true)
    try {
      const newSections = [...allSections]
      const [moved] = newSections.splice(currentIndex, 1)
      newSections.splice(newIndex, 0, moved)
      
      // Update order_index for all affected sections (excluding General)
      const sectionsToReorder = newSections.filter(s => s.name !== 'General')
      const sectionOrders: Array<{ sectionId: string; order_index: number }> = []
      
      for (let i = 0; i < sectionsToReorder.length; i++) {
        const section = sectionsToReorder[i]
        // If section doesn't have an ID, ensure it exists first
        if (!section.id) {
          const result = await ensureSectionExists(tableId, section.name)
          section.id = result.id
        }
        sectionOrders.push({
          sectionId: section.id,
          order_index: i,
        })
      }
      
      if (sectionOrders.length > 0) {
        const result = await reorderSections(tableId, sectionOrders)
        if (!result.success) {
          alert(result.error || 'Failed to reorder sections')
          await loadSections() // Revert on error
          return
        }
      }
      
      // Reload sections to get updated state
      await loadSections()
    } catch (error) {
      console.error("Error reordering sections:", error)
      alert("Failed to reorder sections")
      await loadSections() // Revert on error
    } finally {
      setReorderingSections(false)
    }
  }

  async function loadFields() {
    try {
      // Bypass any intermediate caching so the UI reflects settings changes immediately.
      const response = await fetch(`/api/tables/${tableId}/fields`, { cache: "no-store" })
      const data = await response.json()
      if (data.fields) {
        // Sort by order_index, then by position, then by name
        const sortedFields = [...data.fields].sort((a, b) => {
          const aOrder = a.order_index ?? a.position ?? 0
          const bOrder = b.order_index ?? b.position ?? 0
          if (aOrder !== bOrder) return aOrder - bOrder
          return a.name.localeCompare(b.name)
        })
        setFields(sortedFields)
        // Reload sections after fields are loaded to check for ungrouped fields
        await loadSections()
      }
    } catch (error) {
      console.error("Error loading fields:", error)
    } finally {
      setLoading(false)
    }
  }

  const primaryFieldOptions = useMemo(() => {
    // Exclude virtual/system fields from being a primary label.
    const isVirtual = (f: TableField) => f.type === "formula" || f.type === "lookup"
    const isSystem = (f: TableField) => Boolean((f.options as any)?.system)
    return fields
      .filter((f) => !isVirtual(f) && !isSystem(f))
      .sort((a, b) => {
        const ao = a.order_index ?? a.position ?? 0
        const bo = b.order_index ?? b.position ?? 0
        if (ao !== bo) return ao - bo
        return a.name.localeCompare(b.name)
      })
  }, [fields])

  async function savePrimaryField(next: string | null) {
    if (savingPrimary) return
    setSavingPrimary(true)
    try {
      const res = await fetch(`/api/tables/${tableId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          primary_field_name: next,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data?.error || "Failed to update primary field")
        return
      }
      setPrimaryFieldName(data?.table?.primary_field_name ?? next ?? null)
      onFieldsUpdated()
    } catch (error) {
      console.error("Error saving primary field:", error)
      alert("Failed to update primary field")
    } finally {
      setSavingPrimary(false)
    }
  }

  async function handleReorderFields(newOrder: TableField[]) {
    try {
      // Update order_index for all fields based on their position in the new order
      const updates = newOrder.map((field, index) => ({
        id: field.id,
        order_index: index,
      }))

      const response = await fetch(`/api/tables/${tableId}/fields/reorder`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      })

      if (!response.ok) {
        const data = await response.json()
        console.error("Failed to reorder fields:", data.error || "Unknown error")
        alert(data.error || "Failed to reorder fields")
        // Revert to saved state on error
        await loadFields()
        return
      }

      // Success - fields are already updated in state, just refresh to ensure sync
      await loadFields()
      onFieldsUpdated()
    } catch (error) {
      console.error("Error reordering fields:", error)
      alert("Failed to reorder fields")
      // Revert to saved state on error
      await loadFields()
    }
  }

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event

    if (over && active.id !== over.id) {
      // Find indices in the full fields array (not grouped)
      const oldIndex = fields.findIndex((f) => f.id === active.id)
      const newIndex = fields.findIndex((f) => f.id === over.id)

      if (oldIndex !== -1 && newIndex !== -1) {
        const newOrder = arrayMove(fields, oldIndex, newIndex)
        // Immediately update local state for responsive UI
        setFields(newOrder)
        // Then persist to database
        handleReorderFields(newOrder)
      }
    }
  }

  // Group fields by group_name
  const groupedFields = useMemo(() => {
    const groups: Record<string, TableField[]> = {}
    const ungrouped: TableField[] = []

    fields.forEach((field) => {
      const group = field.group_name || null
      if (group) {
        if (!groups[group]) {
          groups[group] = []
        }
        groups[group].push(field)
      } else {
        ungrouped.push(field)
      }
    })

    return { groups, ungrouped }
  }, [fields])

  async function handleCreateField(fieldData: Partial<TableField>) {
    try {
      // If field has a group_name, ensure the section exists
      if (fieldData.group_name) {
        await ensureSectionExists(tableId, fieldData.group_name)
      }

      const response = await fetch(`/api/tables/${tableId}/fields`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fieldData),
      })

      if (!response.ok) {
        const data = await response.json()
        alert(data.error || "Failed to create field")
        return
      }

      await loadFields()
      await loadSections() // Reload sections in case a new one was created
      onFieldsUpdated()
      setShowNewField(false)
    } catch (error) {
      console.error("Error creating field:", error)
      alert("Failed to create field")
    }
  }

  async function handleUpdateField(fieldId: string, updates: Partial<TableField>) {
    try {
      // If field has a group_name, ensure the section exists
      if (updates.group_name) {
        await ensureSectionExists(tableId, updates.group_name)
      }

      const response = await fetch(`/api/tables/${tableId}/fields`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fieldId,
          ...updates,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        alert(data.error || "Failed to update field")
        return
      }

      await loadFields()
      await loadSections() // Reload sections in case section was changed
      onFieldsUpdated()
      setEditingField(null)
    } catch (error) {
      console.error("Error updating field:", error)
      alert("Failed to update field")
    }
  }

  async function handleDeleteField(fieldId: string, fieldName: string) {
    if (!confirm(`Are you sure you want to delete the field "${fieldName}"? This action cannot be undone.`)) {
      return
    }

    try {
      const response = await fetch(`/api/tables/${tableId}/fields?fieldId=${fieldId}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const data = await response.json()
        alert(data.error || "Failed to delete field")
        return
      }

      await loadFields()
      onFieldsUpdated()
    } catch (error) {
      console.error("Error deleting field:", error)
      alert("Failed to delete field")
    }
  }

  if (loading) {
    return <div className="text-center py-8 text-gray-500">Loading fields...</div>
  }

  // Get all unique section names from fields (including those not in sections table yet)
  const allSectionNames = useMemo(() => {
    const sectionSet = new Set<string>()
    fields.forEach(field => {
      if (field.group_name) {
        sectionSet.add(field.group_name)
      }
    })
    return Array.from(sectionSet)
  }, [fields])

  // Merge sections from DB with sections from fields
  const allSections = useMemo(() => {
    const sectionMap = new Map<string, SectionSettings>()
    
    // Add General section if there are ungrouped fields
    const hasUngroupedFields = fields.some(f => !f.group_name)
    if (hasUngroupedFields) {
      sectionMap.set('General', {
        id: '',
        table_id: tableId,
        name: 'General',
        display_name: 'General',
        order_index: -1,
        default_collapsed: false,
        default_visible: true,
        permissions: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
    }
    
    // Add sections from database
    sections.forEach(section => {
      sectionMap.set(section.name, section)
    })
    
    // Add sections from fields that aren't in DB yet
    allSectionNames.forEach(name => {
      if (!sectionMap.has(name)) {
        sectionMap.set(name, {
          id: '',
          table_id: tableId,
          name: name,
          display_name: name,
          order_index: sections.length,
          default_collapsed: false,
          default_visible: true,
          permissions: {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
      }
    })
    
    // Sort: General first, then by order_index, then by name
    return Array.from(sectionMap.values()).sort((a, b) => {
      if (a.name === 'General') return -1
      if (b.name === 'General') return 1
      if (a.order_index !== b.order_index) return a.order_index - b.order_index
      return a.name.localeCompare(b.name)
    })
  }, [sections, allSectionNames, fields, tableId])

  return (
    <div className="space-y-4">
      {/* Section Ordering */}
      {allSections.length > 0 && (
        <div className="space-y-2">
          <Label className="text-sm font-semibold text-gray-900">Section Order</Label>
          <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-2">
            {allSections.map((section, index) => {
              const fieldCount = fields.filter(f => (f.group_name || 'General') === section.name).length
              const isGeneral = section.name === 'General'
              const canMoveUp = !isGeneral && index > (allSections[0]?.name === 'General' ? 1 : 0)
              const canMoveDown = !isGeneral && index < allSections.length - 1
              
              return (
                <div
                  key={section.name}
                  className="flex items-center justify-between p-2 bg-white rounded border border-gray-200"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-600 w-8">
                      {index + 1}
                    </span>
                    <span className="text-sm font-medium text-gray-900">
                      {section.display_name || section.name}
                    </span>
                    <span className="text-xs text-gray-500">
                      ({fieldCount} {fieldCount === 1 ? 'field' : 'fields'})
                    </span>
                  </div>
                  {!isGeneral && (
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleReorderSections(section.name, 'up')}
                        disabled={!canMoveUp || reorderingSections}
                        className="h-7 w-7 p-0"
                        title="Move up"
                      >
                        <ChevronUp className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleReorderSections(section.name, 'down')}
                        disabled={!canMoveDown || reorderingSections}
                        className="h-7 w-7 p-0"
                        title="Move down"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <p className="text-xs text-gray-500">
            Sections are ordered by their index. Fields will appear in this order in pickers and modals.
          </p>
        </div>
      )}

      <div className="space-y-2">
        <Label className="text-sm font-semibold text-gray-900">Primary / Default Field</Label>
        <Select
          value={primaryFieldName ?? "__auto__"}
          onValueChange={(val) => {
            if (val === "__auto__") return savePrimaryField(null)
            if (val === "id") return savePrimaryField("id")
            return savePrimaryField(val)
          }}
          disabled={savingPrimary}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Choose primary field" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__auto__">Auto (first field)</SelectItem>
            <SelectItem value="id">ID (UUID)</SelectItem>
            {primaryFieldOptions.map((f) => (
              <SelectItem key={f.id} value={f.name}>
                {getFieldDisplayName(f)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-gray-500">
          Used as the record label across pickers, linked records, and titles. “Auto” uses the first non-system field.
        </p>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Fields</h3>
        <Button
          size="sm"
          onClick={() => setShowNewField(true)}
          className="h-8 px-3 text-sm"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          New Field
        </Button>
      </div>

      {showNewField && (
        <NewFieldForm
          tableId={tableId}
          tableFields={fields}
          sections={allSections}
          onSave={handleCreateField}
          onCancel={() => setShowNewField(false)}
        />
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={fields.map((f) => f.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-4">
            {/* Ungrouped fields */}
            {groupedFields.ungrouped.length > 0 && (
              <div className="space-y-2">
                {groupedFields.ungrouped.map((field, index) => {
                  const globalIndex = fields.findIndex(f => f.id === field.id)
                  const orderIndex = field.order_index ?? field.position ?? globalIndex
                  return (
                    <SortableFieldItem
                      key={field.id}
                      field={field}
                      orderIndex={orderIndex + 1}
                      onEdit={() => {
                        setEditingField(field)
                        setSettingsDrawerOpen(true)
                      }}
                      onDelete={() => handleDeleteField(field.id, field.name)}
                    />
                  )
                })}
              </div>
            )}

            {/* Grouped fields */}
            {Object.entries(groupedFields.groups).map(([groupName, groupFields]) => (
              <div key={groupName} className="space-y-2">
                <div className="px-2 py-1 text-xs font-semibold text-gray-600 uppercase tracking-wider bg-gray-50 rounded">
                  {groupName}
                </div>
                {groupFields.map((field) => {
                  const globalIndex = fields.findIndex(f => f.id === field.id)
                  const orderIndex = field.order_index ?? field.position ?? globalIndex
                  return (
                    <SortableFieldItem
                      key={field.id}
                      field={field}
                      orderIndex={orderIndex + 1}
                      onEdit={() => {
                        setEditingField(field)
                        setSettingsDrawerOpen(true)
                      }}
                      onDelete={() => handleDeleteField(field.id, field.name)}
                    />
                  )
                })}
              </div>
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <FieldSettingsDrawer
        field={editingField}
        open={settingsDrawerOpen}
        onOpenChange={(open) => {
          setSettingsDrawerOpen(open)
          if (!open) {
            setEditingField(null)
          }
        }}
        tableId={tableId}
        tableFields={fields}
        sections={allSections}
        onSave={async () => {
          await loadFields()
          await loadSections()
          onFieldsUpdated()
        }}
      />
    </div>
  )
})

function NewFieldForm({
  tableId,
  tableFields,
  sections = [],
  onSave,
  onCancel,
}: {
  tableId: string
  tableFields: TableField[]
  sections?: SectionSettings[]
  onSave: (fieldData: Partial<TableField>) => void
  onCancel: () => void
}) {
  const [name, setName] = useState("")
  const [type, setType] = useState<FieldType>("text")
  const [required, setRequired] = useState(false)
  const [groupName, setGroupName] = useState<string>("")
  const [options, setOptions] = useState<FieldOptions>({})
  const [error, setError] = useState<string | null>(null)

  const [tables, setTables] = useState<Array<{ id: string; name: string }>>([])
  const [loadingTables, setLoadingTables] = useState(false)
  const [lookupTableFields, setLookupTableFields] = useState<Array<{ id: string; name: string; type: string }>>([])
  const [loadingLookupFields, setLoadingLookupFields] = useState(false)

  const fieldTypeInfo = FIELD_TYPES.find(t => t.type === type)
  const isVirtual = fieldTypeInfo?.isVirtual || false

  // Seed options when switching to types that require configuration.
  useEffect(() => {
    setError(null)
    if (type === "single_select" || type === "multi_select") {
      setOptions((prev) => ({
        ...prev,
        choices: prev.choices && prev.choices.length > 0 ? prev.choices : [""],
      }))
      return
    }
    // For other types, keep options as-is to avoid surprising resets (e.g. formula editor).
  }, [type])

  // Load tables for link_to_table and lookup fields.
  useEffect(() => {
    if (type !== "link_to_table" && type !== "lookup") return
    let cancelled = false
    async function loadTables() {
      setLoadingTables(true)
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from("tables")
          .select("id, name")
          .order("name", { ascending: true })
        if (!cancelled && !error && data) {
          setTables(data)
        }
      } catch (e) {
        console.error("Error loading tables:", e)
      } finally {
        if (!cancelled) setLoadingTables(false)
      }
    }
    loadTables()
    return () => {
      cancelled = true
    }
  }, [type])

  // Load fields for lookup table when lookup_table_id is set (auto-determined from linked field)
  useEffect(() => {
    if (type !== "lookup" || !options.lookup_table_id) {
      setLookupTableFields([])
      return
    }
    let cancelled = false
    async function loadFields() {
      setLoadingLookupFields(true)
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from("table_fields")
          .select("id, name, type")
          .eq("table_id", options.lookup_table_id)
          .order("position", { ascending: true })
        if (!cancelled && !error && data) {
          setLookupTableFields(data)
        }
      } catch (e) {
        console.error("Error loading lookup fields:", e)
        if (!cancelled) setLookupTableFields([])
      } finally {
        if (!cancelled) setLoadingLookupFields(false)
      }
    }
    loadFields()
    return () => {
      cancelled = true
    }
  }, [type, options.lookup_table_id])

  function getCleanOptions(): FieldOptions | undefined {
    const next: FieldOptions = { ...options }

    // Trim/filter select choices
    if (next.choices) {
      next.choices = next.choices.map((c) => c.trim()).filter((c) => c.length > 0)
      if (next.choices.length === 0) {
        delete next.choices
      }
    }

    // Remove undefined / null / empty array values
    Object.keys(next).forEach((k) => {
      const key = k as keyof FieldOptions
      const value = next[key]
      if (
        value === undefined ||
        value === null ||
        (Array.isArray(value) && value.length === 0)
      ) {
        delete next[key]
      }
    })

    return Object.keys(next).length > 0 ? next : undefined
  }

  function handleSubmit() {
    if (!name.trim()) {
      setError("Field name is required")
      return
    }

    const cleanOptions = getCleanOptions()
    const validation = validateFieldOptions(type, cleanOptions)
    if (!validation.valid) {
      setError(validation.error || "Invalid field configuration")
      return
    }

    onSave({
      label: name.trim(),
      type,
      required: isVirtual ? false : required,
      group_name: groupName.trim() || null,
      options: cleanOptions,
    })
  }

  function renderTypeSpecificOptions() {
    switch (type) {
      case "single_select":
      case "multi_select": {
        const choices = options.choices && options.choices.length > 0 ? options.choices : [""]
        return (
          <div className="space-y-2">
            <Label className="text-xs font-medium text-gray-700">Choices</Label>
            <div className="space-y-2">
              {choices.map((choice, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Input
                    value={choice}
                    onChange={(e) => {
                      const next = [...choices]
                      next[idx] = e.target.value
                      setOptions({ ...options, choices: next })
                    }}
                    placeholder="Option name"
                    className="h-8 text-sm"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const next = choices.filter((_, i) => i !== idx)
                      setOptions({ ...options, choices: next.length ? next : [""] })
                    }}
                    className="h-8 px-2"
                    title="Remove"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setOptions({ ...options, choices: [...choices, ""] })}
                className="h-8 text-sm"
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Add choice
              </Button>
              <p className="text-xs text-gray-500">
                At least one choice is required.
              </p>
            </div>
          </div>
        )
      }

      case "formula":
        return (
          <div className="space-y-2">
            <Label className="text-xs font-medium text-gray-700">Formula</Label>
            <div className="rounded-md border border-gray-200 bg-white p-2">
              <FormulaEditor
                value={options.formula || ""}
                onChange={(formula) => setOptions({ ...options, formula })}
                tableFields={tableFields.filter((f) => f.type !== "formula")}
              />
            </div>
          </div>
        )

      case "link_to_table":
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-medium text-gray-700">Linked table</Label>
              <Select
                value={options.linked_table_id || undefined}
                onValueChange={(v) =>
                  setOptions({
                    ...options,
                    linked_table_id: v || undefined,
                  })
                }
              >
                <SelectTrigger className="mt-1 h-8 text-sm">
                  <SelectValue placeholder={loadingTables ? "Loading..." : "Select a table"} />
                </SelectTrigger>
                <SelectContent>
                  {loadingTables ? (
                    <SelectItem value="__loading__" disabled>
                      Loading tables...
                    </SelectItem>
                  ) : (
                    tables
                      .filter((t) => t.id !== tableId)
                      .map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                Required to create a link field.
              </p>
            </div>
            
            {options.linked_table_id && (
              <div className="space-y-3 border-t pt-4">
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-gray-700">
                    How many records can be selected
                  </Label>
                  <Select
                    value={options.relationship_type || 'one-to-many'}
                    onValueChange={(relType) =>
                      setOptions({ ...options, relationship_type: relType as any })
                    }
                  >
                    <SelectTrigger className="mt-1 h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="one-to-one">One to One</SelectItem>
                      <SelectItem value="one-to-many">One to Many</SelectItem>
                      <SelectItem value="many-to-many">Many to Many</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500">
                    {(options.relationship_type || 'one-to-many') === 'one-to-one' 
                      ? 'Each row can link to a single record from the linked table.'
                      : 'Each row can link to multiple records from the linked table.'}
                  </p>
                </div>

                {(options.relationship_type === 'one-to-many' || options.relationship_type === 'many-to-many' || !options.relationship_type) && (
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-gray-700">
                      Max Selections (optional)
                    </Label>
                    <Input
                      type="number"
                      min="1"
                      value={options.max_selections || ''}
                      onChange={(e) =>
                        setOptions({ 
                          ...options, 
                          max_selections: e.target.value ? parseInt(e.target.value) : undefined 
                        })
                      }
                      placeholder="No limit"
                      className="mt-1 h-8 text-sm"
                    />
                    <p className="text-xs text-gray-500">
                      Limit the maximum number of linked records that can be selected.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )

      case "lookup":
        // Get linked fields from current table
        const linkedFields = tableFields.filter(
          (f) => f.type === 'link_to_table'
        )

        return (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label className="text-xs font-medium text-gray-700">Linked Field *</Label>
              <Select
                value={options.lookup_field_id || undefined}
                onValueChange={(linkedFieldId) => {
                  // Find the selected linked field to get its linked_table_id
                  const selectedLinkedField = linkedFields.find(f => f.id === linkedFieldId)
                  const linkedTableId = selectedLinkedField?.options?.linked_table_id
                  
                  setOptions({
                    ...options,
                    lookup_field_id: linkedFieldId || undefined,
                    lookup_table_id: linkedTableId || undefined,
                    // Reset result field when linked field changes
                    lookup_result_field_id: undefined,
                  })
                }}
              >
                <SelectTrigger className="mt-1 h-8 text-sm">
                  <SelectValue placeholder="Select a linked field" />
                </SelectTrigger>
                <SelectContent>
                  {linkedFields.length === 0 ? (
                    <SelectItem value="__no_fields__" disabled>
                      No linked fields found. Create a link field first.
                    </SelectItem>
                  ) : (
                    linkedFields.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {getFieldDisplayName(f)}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                Select a linked field in this table that connects to the table you want to look up.
              </p>
            </div>

            {options.lookup_table_id && (
              <div className="space-y-2">
                <Label className="text-xs font-medium text-gray-700">Display Field *</Label>
                <Select
                  value={options.lookup_result_field_id || undefined}
                  onValueChange={(v) =>
                    setOptions({
                      ...options,
                      lookup_result_field_id: v || undefined,
                    })
                  }
                >
                  <SelectTrigger className="mt-1 h-8 text-sm">
                    <SelectValue placeholder={loadingLookupFields ? "Loading..." : "Select a field to display"} />
                  </SelectTrigger>
                  <SelectContent>
                    {loadingLookupFields ? (
                      <SelectItem value="__loading__" disabled>
                        Loading fields...
                      </SelectItem>
                    ) : (
                      lookupTableFields.map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.name} ({f.type})
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500">
                  Select which field from the linked table to display in this lookup field.
                </p>
              </div>
            )}
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
      {error && (
        <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
          {error}
        </div>
      )}
      <div>
        <Label className="text-xs font-medium text-gray-700">Field Name</Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter field name"
          className="mt-1 h-8 text-sm"
        />
      </div>

      <div>
        <Label className="text-xs font-medium text-gray-700">Field Type</Label>
        <Select
          value={type}
          onValueChange={(v) => {
            setType(v as FieldType)
            setError(null)
            // Reset any type-specific options that don't make sense across types.
            setOptions({})
          }}
        >
          <SelectTrigger className="mt-1 h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FIELD_TYPES.map((ft) => (
              <SelectItem key={ft.type} value={ft.type}>
                {ft.label} {ft.isVirtual ? "(Virtual)" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Section Name */}
      <div>
        <Label className="text-xs font-medium text-gray-700">Section Name (Optional)</Label>
        <Select
          value={groupName}
          onValueChange={(value) => setGroupName(value === "__none__" ? "" : value)}
        >
          <SelectTrigger className="mt-1 h-8 text-sm">
            <SelectValue placeholder="Select a section" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">None (General)</SelectItem>
            {sections.filter(s => s.name !== 'General').map((section) => (
              <SelectItem key={section.name} value={section.name}>
                {section.display_name || section.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-gray-500 mt-1">
          Organize fields into sections. Fields with the same section name will be grouped together.
        </p>
      </div>

      {renderTypeSpecificOptions()}

      {!isVirtual && (
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="new-required"
            checked={required}
            onChange={(e) => setRequired(e.target.checked)}
            className="w-4 h-4"
          />
          <Label htmlFor="new-required" className="text-xs text-gray-700">
            Required
          </Label>
        </div>
      )}

      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={!name.trim()}
          className="flex-1 h-8 text-sm"
        >
          <Save className="h-3.5 w-3.5 mr-1.5" />
          Create
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onCancel}
          className="h-8 text-sm"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}

function SortableFieldItem({
  field,
  orderIndex,
  onEdit,
  onDelete,
}: {
  field: TableField
  orderIndex: number
  onEdit: () => void
  onDelete: () => void
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

  const fieldTypeInfo = FIELD_TYPES.find(t => t.type === field.type)
  const isVirtual = fieldTypeInfo?.isVirtual || false

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="p-3 bg-white rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <div
          {...attributes}
          {...listeners}
          className="flex items-center justify-center cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 mt-0.5"
        >
          <GripVertical className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-400 w-6 text-right">
              #{orderIndex}
            </span>
            <span className="text-sm font-medium text-gray-900 truncate">
              {getFieldDisplayName(field)}
            </span>
            {field.required && (
              <span className="text-xs text-red-600">*</span>
            )}
          </div>
          <div className="mt-1 flex items-center gap-2 ml-8">
            <span className="text-xs text-gray-500">
              {FIELD_TYPES.find(t => t.type === field.type)?.label || field.type}
            </span>
            {isVirtual && (
              <span className="text-xs text-blue-600">(Virtual)</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 ml-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={onEdit}
            className="h-7 w-7 p-0"
          >
            <Edit className="h-3.5 w-3.5 text-gray-500" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onDelete}
            className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  )
}

export default FieldBuilderPanel
