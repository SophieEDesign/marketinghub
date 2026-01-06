"use client"

import { useState, useEffect, useMemo } from "react"
import React from "react"
import { supabase } from "@/lib/supabase/client"
import GridView from "./GridView"
import Toolbar from "./Toolbar"
import FieldBuilderDrawer from "./FieldBuilderDrawer"
import type { TableField } from "@/types/fields"
import type { FilterConfig } from "@/lib/interface/filters"

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
  onRecordClick?: (recordId: string) => void // Emit recordId on row click
  standardizedFilters?: FilterConfig[] // Standardized filters (preferred over initialFilters)
  appearance?: {
    show_toolbar?: boolean
    show_search?: boolean
    show_filter?: boolean
    show_sort?: boolean
    row_height?: string
  }
}

export default function GridViewWrapper({
  tableId,
  viewId,
  supabaseTableName,
  viewFields,
  initialFilters,
  standardizedFilters,
  initialSorts,
  initialGroupBy,
  initialTableFields = [],
  isEditing = false,
  onRecordClick,
  appearance = {},
}: GridViewWrapperProps) {
  const [filters, setFilters] = useState<Filter[]>(initialFilters)
  const [sorts, setSorts] = useState<Sort[]>(initialSorts)
  const [groupBy, setGroupBy] = useState<string | undefined>(initialGroupBy)
  const [searchTerm, setSearchTerm] = useState("")
  const [fields, setFields] = useState<TableField[]>(initialTableFields)
  const [fieldBuilderOpen, setFieldBuilderOpen] = useState(false)
  const [editingField, setEditingField] = useState<TableField | null>(null)

  // Sync filters and sorts when initial props change (e.g., from block config)
  useEffect(() => {
    setFilters(initialFilters)
  }, [initialFilters.length, initialFilters.map(f => `${f.field_name}-${f.operator}-${f.value}`).join(',')])

  useEffect(() => {
    setSorts(initialSorts)
  }, [initialSorts.length, initialSorts.map(s => `${s.field_name}-${s.direction}`).join(',')])

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
      // Validate that filterId is a valid UUID format
      // UUIDs are 36 characters: 8-4-4-4-12 (e.g., "550e8400-e29b-41d4-a716-446655440000")
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      const isValidUUID = uuidRegex.test(filterId)

      if (!isValidUUID) {
        // If it's not a valid UUID, it's likely a temporary or block-level filter
        // Just remove it from local state without database deletion
        console.warn(`Filter ID "${filterId}" is not a valid UUID. Removing from local state only.`)
        setFilters((prev) => prev.filter((f) => f.id !== filterId))
        return
      }

      // Valid UUID - attempt database deletion
      const { error } = await supabase
        .from("view_filters")
        .delete()
        .eq("id", filterId)

      if (error) {
        console.error("Error deleting filter:", error)
        // Don't throw - just remove from local state to prevent UI issues
        // The filter might not exist in the database (e.g., temporary filter)
        setFilters((prev) => prev.filter((f) => f.id !== filterId))
        return
      }

      setFilters((prev) => prev.filter((f) => f.id !== filterId))
    } catch (error) {
      console.error("Error deleting filter:", error)
      // Don't throw - just remove from local state to prevent UI issues
      setFilters((prev) => prev.filter((f) => f.id !== filterId))
    }
  }

  async function handleSortCreate(sort: Omit<Sort, "id">) {
    try {
      // Check if view exists first (for SQL-view backed pages)
      const { data: viewExists } = await supabase
        .from("views")
        .select("id")
        .eq("id", viewId)
        .maybeSingle()

      if (!viewExists) {
        console.warn("View does not exist. Cannot create sort for SQL-view backed pages.")
        return
      }

      // Get current max order_index
      const { data: existingSorts, error: fetchError } = await supabase
        .from("view_sorts")
        .select("order_index")
        .eq("view_id", viewId)
        .order("order_index", { ascending: false })
        .limit(1)

      if (fetchError) {
        // If order_index column doesn't exist, try without ordering
        if (fetchError.code === '42703' || fetchError.message?.includes('order_index')) {
          const { data: sortsWithoutOrder } = await supabase
            .from("view_sorts")
            .select("*")
            .eq("view_id", viewId)
          
          const nextOrderIndex = sortsWithoutOrder ? sortsWithoutOrder.length : 0
          
          // Try to insert with order_index first, fallback without if column doesn't exist
          const insertData: any = {
            view_id: viewId,
            field_name: sort.field_name,
            direction: sort.direction,
          }
          
          // Only include order_index if we can determine it (column might not exist yet)
          if (nextOrderIndex >= 0) {
            insertData.order_index = nextOrderIndex
          }
          
          const { data, error } = await supabase
            .from("view_sorts")
            .insert([insertData])
            .select()
            .single()

          if (error) {
            console.error("Error creating sort:", error)
            throw error
          }

          setSorts((prev) => [...prev, { ...sort, id: data.id }])
          return
        }
        throw fetchError
      }

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
      // Validate that sortId is a valid UUID format
      // UUIDs are 36 characters: 8-4-4-4-12 (e.g., "550e8400-e29b-41d4-a716-446655440000")
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      const isValidUUID = uuidRegex.test(sortId)

      if (!isValidUUID) {
        // If it's not a valid UUID, it's likely a temporary or block-level sort
        // Just remove it from local state without database deletion
        console.warn(`Sort ID "${sortId}" is not a valid UUID. Removing from local state only.`)
        setSorts((prev) => prev.filter((s) => s.id !== sortId))
        return
      }

      // Valid UUID - attempt database deletion
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
      // Don't throw - just remove from local state to prevent UI issues
      setSorts((prev) => prev.filter((s) => s.id !== sortId))
    }
  }

  async function handleGroupByChange(fieldName: string | null) {
    try {
      // Update grid view settings instead of views.config
      // Handle case where table doesn't exist (404)
      const { data: existing, error: fetchError } = await supabase
        .from("grid_view_settings")
        .select("id")
        .eq("view_id", viewId)
        .maybeSingle()

      if (fetchError) {
        // If table doesn't exist (PGRST205) or 404, skip update
        if (fetchError.code === 'PGRST205' || fetchError.code === '42P01') {
          console.warn("grid_view_settings table does not exist. Run migration to create it.")
          // Fallback: update in views.config for backward compatibility
          setGroupBy(fieldName || undefined)
          return
        }
        throw fetchError
      }

      if (existing) {
        // Update existing settings
        const { error } = await supabase
          .from("grid_view_settings")
          .update({ group_by_field: fieldName })
          .eq("view_id", viewId)

        if (error) {
          if (error.code === 'PGRST205' || error.code === '42P01') {
            console.warn("grid_view_settings table does not exist. Run migration to create it.")
            setGroupBy(fieldName || undefined)
            return
          }
          throw error
        }
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

        if (error) {
          if (error.code === 'PGRST205' || error.code === '42P01') {
            console.warn("grid_view_settings table does not exist. Run migration to create it.")
            setGroupBy(fieldName || undefined)
            return
          }
          throw error
        }
      }

      setGroupBy(fieldName || undefined)
    } catch (error) {
      console.error("Error updating group by:", error)
      // Don't throw - just log and update state
      setGroupBy(fieldName || undefined)
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

  // Convert filters state to FilterConfig[] format for GridView
  // Use standardizedFilters if provided, otherwise convert filters state
  const gridViewFilters = useMemo<FilterConfig[]>(() => {
    if (standardizedFilters && standardizedFilters.length > 0) {
      return standardizedFilters
    }
    // Convert Filter[] to FilterConfig[]
    return filters.map(f => ({
      field: f.field_name,
      operator: f.operator as FilterConfig['operator'],
      value: f.value,
    }))
  }, [standardizedFilters, filters])

  // Determine toolbar visibility based on appearance settings
  // Default: show toolbar in edit mode, respect appearance settings in view mode
  const showToolbar = appearance.show_toolbar !== false && (isEditing || appearance.show_toolbar === true)
  const showSearch = appearance.show_search !== false && showToolbar
  const showFilter = appearance.show_filter !== false && showToolbar
  const showSort = appearance.show_sort !== false && showToolbar

  return (
    <div className="w-full">
      {/* Show toolbar based on appearance settings */}
      {showToolbar && (
        <Toolbar
          viewId={viewId}
          fields={viewFields}
          tableFields={fields}
          filters={filters}
          sorts={sorts}
          groupBy={groupBy}
          onSearchChange={setSearchTerm}
          onFilterCreate={handleFilterCreate}
          onFilterDelete={handleFilterDelete}
          onSortCreate={handleSortCreate}
          onSortDelete={handleSortDelete}
          onGroupByChange={handleGroupByChange}
          showSearch={showSearch}
          showFilter={showFilter}
          showSort={showSort}
        />
      )}
      <GridView
        tableId={tableId}
        viewId={viewId}
        supabaseTableName={supabaseTableName}
        viewFields={Array.isArray(viewFields) ? viewFields : []}
        viewFilters={Array.isArray(initialFilters) ? initialFilters : []}
        filters={gridViewFilters}
        viewSorts={Array.isArray(sorts) ? sorts : []}
        searchTerm={searchTerm}
        groupBy={groupBy}
        tableFields={fields}
        onAddField={isEditing ? handleAddField : undefined}
        onEditField={isEditing ? handleEditField : undefined}
        isEditing={isEditing}
        onRecordClick={onRecordClick}
        rowHeight={appearance.row_height || 'medium'}
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
