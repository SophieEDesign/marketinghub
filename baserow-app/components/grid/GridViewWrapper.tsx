"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase/client"
import GridView from "./GridView"
import Toolbar from "./Toolbar"
import FieldBuilderDrawer from "./FieldBuilderDrawer"
import type { TableField } from "@/types/fields"

interface Filter {
  id?: string
  field_name: string
  operator: string
  value?: string
}

interface Sort {
  id?: string
  field_name: string
  direction: string
}

interface GridViewWrapperProps {
  tableId: string
  viewId: string
  supabaseTableName: string
  viewFields: Array<{
    field_name: string
    visible: boolean
    position: number
  }>
  initialFilters: Array<{
    id: string
    field_name: string
    operator: string
    value?: string
  }>
  initialSorts: Array<{
    id: string
    field_name: string
    direction: string
  }>
  initialGroupBy?: string
  initialTableFields?: TableField[]
  isEditing?: boolean // When false, hide builder controls (add field, etc.)
}

export default function GridViewWrapper({
  tableId,
  viewId,
  supabaseTableName,
  viewFields,
  initialFilters,
  initialSorts,
  initialGroupBy,
  initialTableFields = [],
  isEditing = false,
}: GridViewWrapperProps) {
  const [filters, setFilters] = useState<Filter[]>(initialFilters)
  const [sorts, setSorts] = useState<Sort[]>(initialSorts)
  const [groupBy, setGroupBy] = useState<string | undefined>(initialGroupBy)
  const [searchTerm, setSearchTerm] = useState("")
  const [fields, setFields] = useState<TableField[]>(initialTableFields)
  const [fieldBuilderOpen, setFieldBuilderOpen] = useState(false)
  const [editingField, setEditingField] = useState<TableField | null>(null)

  async function handleFilterCreate(filter: Omit<Filter, "id">) {
    try {
      const { data, error } = await supabase
        .from("view_filters")
        .insert([
          {
            view_id: viewId,
            field_name: filter.field_name,
            operator: filter.operator,
            value: filter.value,
          },
        ])
        .select()
        .single()

      if (error) {
        console.error("Error creating filter:", error)
        throw error
      }

      setFilters((prev) => [...prev, { ...filter, id: data.id }])
    } catch (error) {
      console.error("Error creating filter:", error)
      throw error
    }
  }

  async function handleFilterDelete(filterId: string) {
    try {
      const { error } = await supabase
        .from("view_filters")
        .delete()
        .eq("id", filterId)

      if (error) {
        console.error("Error deleting filter:", error)
        throw error
      }

      setFilters((prev) => prev.filter((f) => f.id !== filterId))
    } catch (error) {
      console.error("Error deleting filter:", error)
      throw error
    }
  }

  async function handleSortCreate(sort: Omit<Sort, "id">) {
    try {
      // Get current max order_index
      const { data: existingSorts } = await supabase
        .from("view_sorts")
        .select("order_index")
        .eq("view_id", viewId)
        .order("order_index", { ascending: false })
        .limit(1)

      const nextOrderIndex = existingSorts && existingSorts.length > 0
        ? (existingSorts[0].order_index || 0) + 1
        : 0

      const { data, error } = await supabase
        .from("view_sorts")
        .insert([
          {
            view_id: viewId,
            field_name: sort.field_name,
            direction: sort.direction,
            order_index: nextOrderIndex,
          },
        ])
        .select()
        .single()

      if (error) {
        console.error("Error creating sort:", error)
        throw error
      }

      setSorts((prev) => [...prev, { ...sort, id: data.id }])
    } catch (error) {
      console.error("Error creating sort:", error)
      throw error
    }
  }

  async function handleSortDelete(sortId: string) {
    try {
      const { error } = await supabase
        .from("view_sorts")
        .delete()
        .eq("id", sortId)

      if (error) {
        console.error("Error deleting sort:", error)
        throw error
      }

      setSorts((prev) => prev.filter((s) => s.id !== sortId))
    } catch (error) {
      console.error("Error deleting sort:", error)
      throw error
    }
  }

  async function handleGroupByChange(fieldName: string | null) {
    try {
      // Update grid view settings instead of views.config
      const { data: existing } = await supabase
        .from("grid_view_settings")
        .select("id")
        .eq("view_id", viewId)
        .single()

      if (existing) {
        // Update existing settings
        const { error } = await supabase
          .from("grid_view_settings")
          .update({ group_by_field: fieldName })
          .eq("view_id", viewId)

        if (error) throw error
      } else {
        // Create new settings
        const { error } = await supabase
          .from("grid_view_settings")
          .insert([
            {
              view_id: viewId,
              group_by_field: fieldName,
              column_widths: {},
              column_order: [],
              column_wrap_text: {},
              row_height: 'medium',
              frozen_columns: 0,
            },
          ])

        if (error) throw error
      }

      setGroupBy(fieldName || undefined)
    } catch (error) {
      console.error("Error updating group by:", error)
      throw error
    }
  }

  // Load fields
  useEffect(() => {
    loadFields()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableId])

  async function loadFields() {
    try {
      const response = await fetch(`/api/tables/${tableId}/fields`)
      const data = await response.json()
      if (data.fields) {
        setFields(data.fields)
      }
    } catch (error) {
      console.error("Error loading fields:", error)
    }
  }

  function handleAddField() {
    setEditingField(null)
    setFieldBuilderOpen(true)
  }

  function handleEditField(fieldName: string) {
    const field = fields.find(f => f.name === fieldName)
    setEditingField(field || null)
    setFieldBuilderOpen(true)
  }

  async function handleFieldSave() {
    await loadFields()
    // Reload the page to get updated viewFields
    window.location.reload()
  }

  return (
    <div className="w-full">
      {/* Only show toolbar in edit mode - interfaces should look clean in view mode */}
      {isEditing && (
        <Toolbar
          viewId={viewId}
          fields={viewFields}
          filters={filters}
          sorts={sorts}
          groupBy={groupBy}
          onSearchChange={setSearchTerm}
          onFilterCreate={handleFilterCreate}
          onFilterDelete={handleFilterDelete}
          onSortCreate={handleSortCreate}
          onSortDelete={handleSortDelete}
          onGroupByChange={handleGroupByChange}
        />
      )}
      <GridView
        tableId={tableId}
        viewId={viewId}
        supabaseTableName={supabaseTableName}
        viewFields={viewFields}
        viewFilters={filters}
        viewSorts={sorts}
        searchTerm={searchTerm}
        groupBy={groupBy}
        tableFields={fields}
        onAddField={isEditing ? handleAddField : undefined}
        onEditField={isEditing ? handleEditField : undefined}
        isEditing={isEditing}
      />
      <FieldBuilderDrawer
        isOpen={fieldBuilderOpen}
        onClose={() => {
          setFieldBuilderOpen(false)
          setEditingField(null)
        }}
        tableId={tableId}
        field={editingField}
        onSave={handleFieldSave}
        tableFields={fields}
      />
    </div>
  )
}
