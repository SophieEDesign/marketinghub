"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { useRouter } from "next/navigation"
import React from "react"
import { supabase } from "@/lib/supabase/client"
import GridView from "./GridView"
import Toolbar from "./Toolbar"
import FieldBuilderDrawer from "./FieldBuilderDrawer"
import type { TableField } from "@/types/fields"
import type { FilterConfig } from "@/lib/interface/filters"
import { stripFilterBlockFilters } from "@/lib/interface/filters"
import type { FilterTree } from "@/lib/filters/canonical-model"
import { asArray } from "@/lib/utils/asArray"
import { normalizeUuid } from "@/lib/utils/ids"
import type { GroupRule } from "@/lib/grouping/types"
import type { HighlightRule } from "@/lib/interface/types"

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
  initialGroupByRules?: GroupRule[] // Nested grouping rules from block config
  initialTableFields?: TableField[]
  isEditing?: boolean // When false, hide builder controls (add field, etc.)
  onRecordClick?: (recordId: string) => void // Emit recordId on row click
  standardizedFilters?: FilterConfig[] // Standardized filters (preferred over initialFilters)
  filterTree?: FilterTree // Canonical filter tree from filter blocks (supports groups/OR)
  modalFields?: string[] // Fields to show in modal (deprecated: use field_layout)
  modalLayout?: any // Custom modal layout (deprecated: use field_layout)
  fieldLayout?: any // Unified field layout (preferred)
  /** Optional: when provided, permission flags are applied in RecordModal/RecordPanel. */
  cascadeContext?: { pageConfig?: any; blockConfig?: any } | null
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
  /** Bump to force GridView to refetch rows (e.g. after external record creation). */
  reloadKey?: number
  /** Block-level settings from block config - these should be hidden from UI */
  blockLevelSettings?: {
    filters?: boolean // true if filters come from block config
    sorts?: boolean // true if sorts come from block config
    groupBy?: boolean // true if groupBy comes from block config
  }
  /** When grouping, should groups start collapsed? Default: true (closed). */
  defaultGroupsCollapsed?: boolean
  /** Callback when block content height changes (for grouped blocks) */
  onHeightChange?: (height: number) => void
  /** Row height in pixels (for height calculation) */
  rowHeightPixels?: number
  /** Conditional formatting rules */
  highlightRules?: HighlightRule[]
  /** When provided, RecordModal can save field layout (in-modal edit). */
  onModalLayoutSave?: (fieldLayout: import("@/lib/interface/field-layout-utils").FieldLayoutItem[]) => void
  /** When true, show "Edit layout" in record modal. */
  canEditLayout?: boolean
  /** When true, modal opens directly in layout edit mode */
  initialModalEditMode?: boolean
  /** Record ID to open in edit mode. When set, opens that record with initialModalEditMode=true */
  openRecordInEditMode?: string | null
  /** Interface mode: 'view' | 'edit'. When 'edit', all record modals open in edit mode (Airtable-style). */
  interfaceMode?: 'view' | 'edit'
  /** Optional block id for record modal remount key. */
  blockId?: string | null
}

export default function GridViewWrapper({
  tableId,
  viewId,
  supabaseTableName,
  viewFields,
  initialFilters,
  standardizedFilters,
  filterTree = null,
  initialSorts,
  initialGroupBy,
  initialGroupByRules,
  initialTableFields = [],
  isEditing = false,
  onRecordClick,
  modalFields,
  modalLayout,
  fieldLayout,
  cascadeContext,
  appearance = {},
  permissions,
  hideEmptyState = false, // Hide "No columns configured" UI (for record view contexts)
  reloadKey,
  blockLevelSettings = {},
  defaultGroupsCollapsed = true,
  onHeightChange,
  rowHeightPixels = 30,
  highlightRules = [],
  onModalLayoutSave,
  canEditLayout = false,
  initialModalEditMode = false,
  openRecordInEditMode = null,
  interfaceMode = 'view',
  blockId = null,
}: GridViewWrapperProps) {
  const router = useRouter()
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
  const [groupByRules, setGroupByRules] = useState<GroupRule[] | undefined>(undefined)
  const [searchTerm, setSearchTerm] = useState("")
  const [fields, setFields] = useState<TableField[]>(safeInitialTableFields)
  const [fieldBuilderOpen, setFieldBuilderOpen] = useState(false)
  const [editingField, setEditingField] = useState<TableField | null>(null)
  const [viewRowHeight, setViewRowHeight] = useState<string | null>(null)

  // `viewId` can sometimes be a composite like "<uuid>:<index>".
  // Only use a strict UUID for DB writes/reads.
  const viewUuid = useMemo(() => normalizeUuid(viewId), [viewId])
  
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
  
  // Load row height from grid_view_settings (view-level) as fallback when block-level is not set
  useEffect(() => {
    if (!viewUuid) {
      setViewRowHeight(null)
      return
    }
    
    // If block-level setting exists, don't load from view-level
    if (appearance.row_height) {
      setViewRowHeight(null)
      return
    }
    
    async function loadViewRowHeight() {
      try {
        const { data, error } = await supabase
          .from("grid_view_settings")
          .select("row_height")
          .eq("view_id", viewUuid)
          .maybeSingle()

        if (error) {
          // Table might not exist yet, ignore
          if (error.code === 'PGRST205' || error.code === '42P01') {
            return
          }
          console.warn("Error loading view row height:", error)
          return
        }

        if (data?.row_height) {
          setViewRowHeight(data.row_height)
        } else {
          setViewRowHeight(null)
        }
      } catch (error) {
        console.warn("Error loading view row height:", error)
      }
    }

    loadViewRowHeight()
  }, [viewUuid, appearance.row_height])
  
  // Use block appearance settings first, then fall back to view-level settings
  const rowHeight = mapRowHeight(appearance.row_height || viewRowHeight || undefined)
  const wrapText = appearance.wrap_text || false

  // Track previous values to prevent infinite loops
  const prevInitialFiltersRef = useRef<string>('')
  const prevInitialSortsRef = useRef<string>('')
  const prevInitialGroupByRef = useRef<string>('')
  
  // Order-insensitive keys: upstream arrays can reorder between renders.
  // If we treat order changes as "new config", we can trigger state churn and downstream fetch loops.
  const initialFiltersKey = useMemo(() => {
    const canonical = (safeInitialFilters ?? [])
      .map((f: any) => ({
        field_name: typeof f?.field_name === 'string' ? f.field_name : '',
        operator: typeof f?.operator === 'string' ? f.operator : '',
        value:
          f?.value == null
            ? ''
            : Array.isArray(f.value)
              ? f.value.map((v: any) => String(v)).sort().join('|')
              : String(f.value),
      }))
      .filter((f) => f.field_name || f.operator || f.value)
      .sort((a, b) => {
        const ak = `${a.field_name}\u0000${a.operator}\u0000${a.value}`
        const bk = `${b.field_name}\u0000${b.operator}\u0000${b.value}`
        return ak.localeCompare(bk)
      })
    return JSON.stringify(canonical)
  }, [safeInitialFilters])

  const initialSortsKey = useMemo(() => {
    const canonical = (safeInitialSorts ?? [])
      .map((s: any) => ({
        field_name: typeof s?.field_name === 'string' ? s.field_name : '',
        direction: typeof s?.direction === 'string' ? s.direction : '',
      }))
      .filter((s) => s.field_name || s.direction)
      .sort((a, b) => {
        const ak = `${a.field_name}\u0000${a.direction}`
        const bk = `${b.field_name}\u0000${b.direction}`
        return ak.localeCompare(bk)
      })
    return JSON.stringify(canonical)
  }, [safeInitialSorts])
  
  // Sync filters and sorts when initial props change (e.g., from block config)
  useEffect(() => {
    if (prevInitialFiltersRef.current !== initialFiltersKey) {
      prevInitialFiltersRef.current = initialFiltersKey
      setFilters(safeInitialFilters)
    }
  }, [initialFiltersKey, safeInitialFilters])

  useEffect(() => {
    if (prevInitialSortsRef.current !== initialSortsKey) {
      prevInitialSortsRef.current = initialSortsKey
      setSorts(safeInitialSorts)
    }
  }, [initialSortsKey, safeInitialSorts])

  useEffect(() => {
    const groupKey = initialGroupBy || ''
    if (prevInitialGroupByRef.current !== groupKey) {
      prevInitialGroupByRef.current = groupKey
      setGroupBy(initialGroupBy)
    }
  }, [initialGroupBy])

  // Load group_by_rules from grid_view_settings
  // Priority: 1) grid_view_settings.group_by_rules (nested groups), 2) initialGroupBy (block config), 3) grid_view_settings.group_by_field (legacy)
  useEffect(() => {
    if (!viewUuid) return

    async function loadGroupRules() {
      try {
        // First, try to load from grid_view_settings (this includes nested groups)
        const { data: settings, error } = await supabase
          .from("grid_view_settings")
          .select("group_by_rules, group_by_field")
          .eq("view_id", viewUuid)
          .maybeSingle()

        if (error && error.code !== 'PGRST116') {
          console.error("Error loading group rules:", error)
          return
        }

        // Priority: 1) initialGroupByRules (block config nested groups), 2) database group_by_rules, 3) initialGroupBy (block config single field), 4) database group_by_field
        if (initialGroupByRules && Array.isArray(initialGroupByRules) && initialGroupByRules.length > 0) {
          // Block config nested groups take highest priority
          setGroupByRules(initialGroupByRules)
          const firstRule = initialGroupByRules[0]
          if (firstRule.type === 'field') {
            setGroupBy(firstRule.field)
          }
          return
        }

        // If we have group_by_rules in the database, use those (nested groups take precedence)
        if (settings?.group_by_rules && Array.isArray(settings.group_by_rules) && settings.group_by_rules.length > 0) {
          setGroupByRules(settings.group_by_rules as GroupRule[])
          // Also set groupBy for backward compatibility
          const firstRule = settings.group_by_rules[0] as GroupRule
          if (firstRule.type === 'field') {
            setGroupBy(firstRule.field)
          }
          return
        }

        // If no nested groups, check for initialGroupBy from block config
        if (initialGroupBy) {
          // Convert initialGroupBy to rules format
          const rules: GroupRule[] = [{ type: 'field', field: initialGroupBy }]
          setGroupByRules(rules)
          setGroupBy(initialGroupBy)
          return
        }

        // Fallback to legacy group_by_field from database
        if (settings?.group_by_field) {
          const rules: GroupRule[] = [{ type: 'field', field: settings.group_by_field }]
          setGroupByRules(rules)
          setGroupBy(settings.group_by_field)
          return
        }

        // No grouping found
        setGroupByRules(undefined)
        setGroupBy(undefined)
        const { data: fallbackData, error: fallbackError } = await supabase
          .from("grid_view_settings")
          .select("group_by_rules, group_by_field")
          .eq("view_id", viewUuid)
          .maybeSingle()

        if (fallbackError && fallbackError.code !== 'PGRST116') {
          console.error("Error loading group rules:", fallbackError)
          return
        }

        if (fallbackData) {
          // Prefer group_by_rules if available, otherwise convert group_by_field
          if (fallbackData.group_by_rules && Array.isArray(fallbackData.group_by_rules) && fallbackData.group_by_rules.length > 0) {
            setGroupByRules(fallbackData.group_by_rules as GroupRule[])
            // Also set groupBy for backward compatibility
            const firstRule = fallbackData.group_by_rules[0] as GroupRule
            if (firstRule.type === 'field') {
              setGroupBy(firstRule.field)
            }
          } else if (fallbackData.group_by_field) {
            // Convert legacy group_by_field to rules
            const rules: GroupRule[] = [{ type: 'field', field: fallbackData.group_by_field }]
            setGroupByRules(rules)
            setGroupBy(fallbackData.group_by_field)
          } else {
            setGroupByRules(undefined)
            setGroupBy(undefined)
          }
        }
      } catch (error) {
        console.error("Error loading group rules:", error)
      }
    }

    loadGroupRules()
  }, [viewUuid, initialGroupBy, initialGroupByRules])

  async function handleFilterCreate(filter: Omit<Filter, "id">) {
    try {
      if (!viewUuid) {
        console.warn("GridViewWrapper: viewId is not a valid UUID; cannot persist filter.")
        setFilters((prev) => [...prev, { ...filter, id: `local:${Date.now()}` }])
        return
      }
      const { data, error } = await supabase
        .from("view_filters")
        .insert([
          {
            view_id: viewUuid,
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
      if (!viewUuid) {
        console.warn("GridViewWrapper: viewId is not a valid UUID; cannot persist sort.")
        return
      }
      // Check if view exists first (for SQL-view backed pages)
      const { data: viewExists } = await supabase
        .from("views")
        .select("id")
        .eq("id", viewUuid)
        .maybeSingle()

      if (!viewExists) {
        console.warn("View does not exist. Cannot create sort for SQL-view backed pages.")
        return
      }

      // Get current max order_index
      const { data: existingSorts, error: fetchError } = await supabase
        .from("view_sorts")
        .select("order_index")
        .eq("view_id", viewUuid)
        .order("order_index", { ascending: false })
        .limit(1)

      if (fetchError) {
        // If order_index column doesn't exist, try without ordering
        if (fetchError.code === '42703' || fetchError.message?.includes('order_index')) {
          const { data: sortsWithoutOrder } = await supabase
            .from("view_sorts")
            .select("*")
            .eq("view_id", viewUuid)
          
          const nextOrderIndex = sortsWithoutOrder ? sortsWithoutOrder.length : 0
          
          // Try to insert with order_index first, fallback without if column doesn't exist
          const insertData: any = {
            view_id: viewUuid,
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
            view_id: viewUuid,
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
    // Legacy handler - convert to rules format
    const rules: GroupRule[] | null = fieldName ? [{ type: 'field', field: fieldName }] : null
    await handleGroupRulesChange(rules)
  }

  async function handleGroupRulesChange(rules: GroupRule[] | null) {
    try {
      if (!viewUuid) {
        console.warn("GridViewWrapper: viewId is not a valid UUID; cannot persist grouping.")
        setGroupByRules(rules || undefined)
        // Also update groupBy for backward compatibility
        if (rules && rules.length > 0 && rules[0].type === 'field') {
          setGroupBy(rules[0].field)
        } else {
          setGroupBy(undefined)
        }
        return
      }
      // Update grid view settings instead of views.config
      // Handle case where table doesn't exist (404)
      const { data: existing, error: fetchError } = await supabase
        .from("grid_view_settings")
        .select("id")
        .eq("view_id", viewUuid)
        .maybeSingle()

      if (fetchError) {
        // If table doesn't exist (PGRST205) or 404, skip update
        if (fetchError.code === 'PGRST205' || fetchError.code === '42P01') {
          console.warn("grid_view_settings table does not exist. Run migration to create it.")
          // Fallback: update state only
          setGroupByRules(rules || undefined)
          if (rules && rules.length > 0 && rules[0].type === 'field') {
            setGroupBy(rules[0].field)
          } else {
            setGroupBy(undefined)
          }
          return
        }
        throw fetchError
      }

      // For backward compatibility, also set group_by_field to the first rule's field
      const groupByFieldValue = rules && rules.length > 0 && rules[0].type === 'field' ? rules[0].field : null

      if (existing) {
        // Update existing settings
        const { error } = await supabase
          .from("grid_view_settings")
          .update({ 
            group_by_rules: rules,
            group_by_field: groupByFieldValue, // Keep for backward compatibility
          })
          .eq("view_id", viewUuid)

        if (error) {
          if (error.code === 'PGRST205' || error.code === '42P01') {
            console.warn("grid_view_settings table does not exist. Run migration to create it.")
            setGroupByRules(rules || undefined)
            setGroupBy(groupByFieldValue || undefined)
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
              view_id: viewUuid,
              group_by_rules: rules,
              group_by_field: groupByFieldValue, // Keep for backward compatibility
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
            setGroupByRules(rules || undefined)
            setGroupBy(groupByFieldValue || undefined)
            return
          }
          throw error
        }
      }

      setGroupByRules(rules || undefined)
      setGroupBy(groupByFieldValue || undefined)
    } catch (error) {
      console.error("Error updating group rules:", error)
      // Don't throw - just log and update state
      setGroupByRules(rules || undefined)
      if (rules && rules.length > 0 && rules[0].type === 'field') {
        setGroupBy(rules[0].field)
      } else {
        setGroupBy(undefined)
      }
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
    // Reload the page to get updated viewFields (Phase 4: avoid full-page reload)
    router.refresh()
  }

  // Track deleted block-level filters (by field name) to prevent re-application
  const [deletedBlockLevelFilters, setDeletedBlockLevelFilters] = useState<Set<string>>(new Set())

  // Convert filters state to FilterConfig[] format for GridView
  // Merge standardizedFilters (block-level) with user-created filters
  // Exclude block-level filters that have been explicitly deleted by the user
  const gridViewFilters = useMemo<FilterConfig[]>(() => {
    const standardizedForQuery = filterTree ? stripFilterBlockFilters(standardizedFilters || []) : (standardizedFilters || [])

    const blockLevelFilters = standardizedForQuery.filter(f => {
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
  }, [standardizedFilters, filters, deletedBlockLevelFilters, filterTree])

  // Merge block-level filters with user-created filters for display in Toolbar
  // If blockLevelSettings.filters is true, hide block-level filters from UI
  const displayFilters = useMemo<Array<Filter & { isBlockLevel?: boolean; sourceBlockId?: string; sourceBlockTitle?: string }>>(() => {
    // If filters are from block config, only show user-created filters
    if (blockLevelSettings.filters) {
      return filters.filter(f => {
        // Only include filters with valid UUID IDs (user-created filters)
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        return f.id && uuidRegex.test(f.id)
      })
    }
    
    // Otherwise, show both block-level and user-created filters
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
  }, [standardizedFilters, filters, blockLevelSettings.filters])
  
  // Filter sorts for display - hide block-level sorts if from block config
  const displaySorts = useMemo<Sort[]>(() => {
    // If sorts are from block config, only show user-created sorts
    if (blockLevelSettings.sorts) {
      return sorts.filter(s => {
        // Only include sorts with valid UUID IDs (user-created sorts)
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        return s.id && uuidRegex.test(s.id)
      })
    }
    // Otherwise, show all sorts
    return sorts
  }, [sorts, blockLevelSettings.sorts])
  
  // Filter groupBy for display - hide if from block config
  const displayGroupBy = useMemo<string | undefined>(() => {
    // If groupBy is from block config, don't show it in UI
    if (blockLevelSettings.groupBy) {
      return undefined
    }
    return groupBy
  }, [groupBy, blockLevelSettings.groupBy])

  // Determine toolbar visibility based on appearance settings.
  // Keep edit mode WYSIWYG (match live view).
  // Default: undefined => shown (matches Settings UI)
  const showToolbar = appearance.show_toolbar !== false
  const showSearch = showToolbar && appearance.show_search !== false
  const showFilter = showToolbar && appearance.show_filter !== false
  const showSort = showToolbar && appearance.show_sort !== false

  return (
    <div className="w-full h-full flex flex-col min-w-0">
      {/* Show toolbar based on appearance settings */}
      {showToolbar && (
        <div className="flex-shrink-0">
          <Toolbar
            viewId={viewId}
            fields={safeViewFields as any}
            tableFields={fields}
            filters={displayFilters}
            sorts={displaySorts}
            groupBy={displayGroupBy}
            groupByRules={groupByRules}
            onSearchChange={setSearchTerm}
            onFilterCreate={handleFilterCreate}
            onFilterDelete={handleFilterDelete}
            onSortCreate={handleSortCreate}
            onSortDelete={handleSortDelete}
            onGroupByChange={handleGroupByChange}
            onGroupRulesChange={handleGroupRulesChange}
            showSearch={showSearch}
            showFilter={showFilter}
            showSort={showSort}
          />
        </div>
      )}
      <div className="flex-1 min-h-0 min-w-0">
        <GridView
        tableId={tableId}
        viewId={viewId}
        supabaseTableName={supabaseTableName}
        viewFields={safeViewFields}
        viewFilters={safeInitialFilters}
        filters={gridViewFilters}
        filterTree={filterTree}
        viewSorts={asArray(sorts)}
        searchTerm={searchTerm}
        groupBy={groupBy}
        groupByRules={groupByRules}
        tableFields={fields}
        onAddField={isEditing ? handleAddField : undefined}
        onEditField={isEditing ? handleEditField : undefined}
        isEditing={isEditing}
        interfaceMode={interfaceMode}
        blockId={blockId}
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
          modalLayout={modalLayout}
          fieldLayout={fieldLayout}
          cascadeContext={cascadeContext}
          onTableFieldsRefresh={loadFields}
          reloadKey={reloadKey}
          defaultGroupsCollapsed={defaultGroupsCollapsed}
          onFilterCreate={handleFilterCreate}
          onGroupByChange={handleGroupByChange}
          onHeightChange={onHeightChange}
          highlightRules={highlightRules}
          onModalLayoutSave={onModalLayoutSave}
          canEditLayout={canEditLayout}
          initialModalEditMode={initialModalEditMode || !!openRecordInEditMode}
          openRecordInEditMode={openRecordInEditMode}
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
