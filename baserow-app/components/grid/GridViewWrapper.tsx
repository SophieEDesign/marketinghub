"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import React from "react"
import { supabase } from "@/lib/supabase/client"
import GridView from "./GridView"
import Toolbar from "./Toolbar"
import FieldBuilderDrawer from "./FieldBuilderDrawer"
import type { TableField } from "@/types/fields"
import type { FilterConfig } from "@/lib/interface/filters"
import { asArray } from "@/lib/utils/asArray"

interface Filter {
  id?: string
  field_name: string
  operator: string
  value?: string
  isBlockLevel?: boolean // True for block-level filters (non-deletable)
}

interface Sort {
  id?: string
  field_name: string
  direction: string
}

interface BlockPermissions {
  mode?: 'view' | 'edit'
  allowInlineCreate?: boolean
  allowInlineDelete?: boolean
  allowOpenRecord?: boolean
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
  modalFields?: string[] // Fields to show in modal (if empty, show all)
  appearance?: {
    show_toolbar?: boolean
    show_search?: boolean
    show_filter?: boolean
    show_sort?: boolean
    row_height?: string
    wrap_text?: boolean
    color_field?: string
    image_field?: string
    fit_image_size?: boolean
    enable_record_open?: boolean
    record_open_style?: 'side_panel' | 'modal'
  }
  permissions?: BlockPermissions // Block-level permissions
  hideEmptyState?: boolean // Hide "No columns configured" UI (for record view contexts)
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
  modalFields,
  appearance = {},
  permissions,
  hideEmptyState = false, // Hide "No columns configured" UI (for record view contexts)
}: GridViewWrapperProps) {
  // CRITICAL: Normalize all inputs at wrapper entry point
  const safeInitialFilters = asArray<Filter>(initialFilters)
  const safeInitialSorts = asArray<Sort>(initialSorts)
  const safeInitialTableFields = asArray<TableField>(initialTableFields)
  type ViewFieldType = {
    field_name: string
    visible: boolean
    position: number
  }
  const safeViewFields = asArray<ViewFieldType>(viewFields)

  // Defensive logging (temporary - remove after fixing all upstream issues)
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    console.log('GridViewWrapper input types', {
      viewFields: Array.isArray(viewFields),
      initialFilters: Array.isArray(initialFilters),
      initialSorts: Array.isArray(initialSorts),
      initialTableFields: Array.isArray(initialTableFields),
    })
  }

  const [filters, setFilters] = useState<Filter[]>(safeInitialFilters)
  const [sorts, setSorts] = useState<Sort[]>(safeInitialSorts)
  const [groupBy, setGroupBy] = useState<string | undefined>(initialGroupBy)
  const [searchTerm, setSearchTerm] = useState("")
  const [fields, setFields] = useState<TableField[]>(safeInitialTableFields)
  const [fieldBuilderOpen, setFieldBuilderOpen] = useState(false)
  const [editingField, setEditingField] = useState<TableField | null>(null)
  
  // CRITICAL: Use block-level appearance settings for row height and wrapping
  // Block settings take precedence over view-level settings
  // Map row height from block config (supports 'compact', 'standard', 'comfortable', and legacy 'medium')
  const mapRowHeight = (height: string | undefined): string => {
    if (!height) return 'standard'
    // Legacy support: map old values
    if (height === 'short') return 'compact'
    if (height === 'tall') return 'comfortable'
    if (height === 'medium') return 'standard'
    return height // Already in correct format
  }
  
  // Use block appearance settings (block-level control)
  const rowHeight = mapRowHeight(appearance.row_height)
  const wrapText = appearance.wrap_text || false

  // Track previous values to prevent infinite loops
  const prevInitialFiltersRef = useRef<string>('')
  const prevInitialSortsRef = useRef<string>('')
  
  // Sync filters and sorts when initial props change (e.g., from block config)
  useEffect(() => {
    const filtersKey = JSON.stringify(safeInitialFilters)
    if (prevInitialFiltersRef.current !== filtersKey) {
      prevInitialFiltersRef.current = filtersKey
      setFilters(safeInitialFilters)
    }
  }, [safeInitialFilters])

  useEffect(() => {
    const sortsKey = JSON.stringify(safeInitialSorts)
    if (prevInitialSortsRef.current !== sortsKey) {
      prevInitialSortsRef.current = sortsKey
      setSorts(safeInitialSorts)
    }
  }, [safeInitialSorts])

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
        // If it's not a valid UUID, it's a block-level filter (from block config or filter blocks)
        // Block-level filters cannot be deleted through the UI - they're managed in block settings
        console.warn(`Filter ID "${filterId}" is not a valid UUID. This is a block-level filter and cannot be deleted from the toolbar.`)
        return // Don't remove block-level filters - they're controlled by block config
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

  // Track deleted block-level filters (by field name) to prevent re-application
  const [deletedBlockLevelFilters, setDeletedBlockLevelFilters] = useState<Set<string>>(new Set())

  // Convert filters state to FilterConfig[] format for GridView
  // Merge standardizedFilters (block-level) with user-created filters
  // Exclude block-level filters that have been explicitly deleted by the user
  const gridViewFilters = useMemo<FilterConfig[]>(() => {
    const blockLevelFilters = (standardizedFilters || []).filter(f => {
      // Exclude block-level filters that the user has explicitly deleted
      return !deletedBlockLevelFilters.has(f.field)
    })
    
    const userCreatedFilters = filters
      .filter(f => {
        // Only include filters with valid UUID IDs (user-created filters)
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        return f.id && uuidRegex.test(f.id)
      })
      .map(f => ({
        field: f.field_name,
        operator: f.operator as FilterConfig['operator'],
        value: f.value,
      }))
    
    // Merge block-level filters with user-created filters
    // Block-level filters take precedence (they're applied first)
    return [...blockLevelFilters, ...userCreatedFilters]
  }, [standardizedFilters, filters, deletedBlockLevelFilters])

  // Merge block-level filters with user-created filters for display in Toolbar
  // Block-level filters are marked as non-deletable and show source information
  const displayFilters = useMemo<Array<Filter & { isBlockLevel?: boolean; sourceBlockId?: string; sourceBlockTitle?: string }>>(() => {
    const blockLevelFilters: Array<Filter & { isBlockLevel?: boolean; sourceBlockId?: string; sourceBlockTitle?: string }> = (standardizedFilters || []).map(f => {
      // Check if this filter has source information (from filter blocks)
      const filterWithSource = f as any
      return {
        id: f.field, // Use field name as ID for block-level filters
        field_name: f.field,
        operator: f.operator,
        value: f.value,
        isBlockLevel: true, // Mark as block-level (non-deletable)
        sourceBlockId: filterWithSource.sourceBlockId,
        sourceBlockTitle: filterWithSource.sourceBlockTitle,
      }
    })
    
    const userCreatedFilters = filters.filter(f => {
      // Only include filters with valid UUID IDs (user-created filters)
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      return f.id && uuidRegex.test(f.id)
    })
    
    // Merge: block-level filters first, then user-created filters
    return [...blockLevelFilters, ...userCreatedFilters]
  }, [standardizedFilters, filters])

  // Determine toolbar visibility based on appearance settings
  // Default: show toolbar in edit mode, respect appearance settings in view mode
  const showToolbar = appearance.show_toolbar !== false && (isEditing || appearance.show_toolbar === true)
  const showSearch = appearance.show_search !== false && showToolbar
  const showFilter = appearance.show_filter !== false && showToolbar
  const showSort = appearance.show_sort !== false && showToolbar

  return (
    <div className="w-full h-full flex flex-col">
      {/* Show toolbar based on appearance settings */}
      {showToolbar && (
        <div className="flex-shrink-0">
          <Toolbar
            viewId={viewId}
            fields={safeViewFields as any}
            tableFields={fields}
            filters={displayFilters}
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
        </div>
      )}
      <div className="flex-1 min-h-0">
        <GridView
        tableId={tableId}
        viewId={viewId}
        supabaseTableName={supabaseTableName}
        viewFields={safeViewFields}
        viewFilters={safeInitialFilters}
        filters={gridViewFilters}
        viewSorts={asArray(sorts)}
        searchTerm={searchTerm}
        groupBy={groupBy}
        tableFields={fields}
        onAddField={isEditing ? handleAddField : undefined}
        onEditField={isEditing ? handleEditField : undefined}
        isEditing={isEditing}
        onRecordClick={onRecordClick}
          rowHeight={rowHeight}
          wrapText={wrapText}
          permissions={permissions}
          colorField={appearance.color_field}
          imageField={appearance.image_field}
          fitImageSize={appearance.fit_image_size}
          hideEmptyState={hideEmptyState}
          enableRecordOpen={appearance.enable_record_open !== false}
          recordOpenStyle={appearance.record_open_style || 'side_panel'}
          modalFields={modalFields}
        />
      </div>
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
