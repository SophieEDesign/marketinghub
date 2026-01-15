"use client"

import { useEffect, useState, useMemo, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import type { PageBlock } from "@/lib/interface/types"
import ListView from "@/components/views/ListView"
import { mergeFilters, type FilterConfig } from "@/lib/interface/filters"
import { useViewMeta } from "@/hooks/useViewMeta"
import { asArray } from "@/lib/utils/asArray"
import type { TableField } from "@/types/fields"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"

interface ListBlockProps {
  block: PageBlock
  isEditing?: boolean
  pageTableId?: string | null
  pageId?: string | null
  filters?: FilterConfig[]
  onRecordClick?: (recordId: string) => void
}

export default function ListBlock({ block, isEditing = false, pageTableId = null, pageId = null, filters = [], onRecordClick }: ListBlockProps) {
  const { config } = block
  const tableId = config?.table_id || pageTableId || config?.base_table || null
  const viewId = config?.view_id
  const blockBaseFilters = Array.isArray(config?.filters) ? config.filters : []
  const sortsConfig = Array.isArray(config?.sorts) ? config.sorts : []
  
  // Merge filters
  const allFilters = useMemo(() => {
    return mergeFilters(blockBaseFilters, filters, [])
  }, [blockBaseFilters, filters])

  const [loading, setLoading] = useState(true)
  const [table, setTable] = useState<{ supabase_table: string } | null>(null)
  const [tableFields, setTableFields] = useState<TableField[]>([])
  
  // Get groupBy from block config (not view config)
  const groupBy = config?.group_by
  
  // Use cached metadata hook
  const { metadata: viewMeta, loading: metaLoading } = useViewMeta(viewId, tableId)

  const safeTableFields = asArray<TableField>(tableFields)

  const viewSorts = useMemo(() => {
    if (!viewMeta?.sorts) return []
    return viewMeta.sorts.map(s => ({
      id: s.id || '',
      field_name: s.field_name,
      direction: s.direction,
    }))
  }, [viewMeta?.sorts])

  // Track loading state
  const loadingRef = useRef(false)
  const tableIdRef = useRef<string | null>(null)
  const viewIdRef = useRef<string | null | undefined>(null)
  const prevTableIdRef = useRef<string | null>(null)
  const prevViewIdRef = useRef<string | null | undefined>(null)

  useEffect(() => {
    if (!tableId) {
      setLoading(false)
      prevTableIdRef.current = null
      prevViewIdRef.current = null
      return
    }

    const tableIdChanged = prevTableIdRef.current !== tableId
    const viewIdChanged = prevViewIdRef.current !== viewId
    
    if (!tableIdChanged && !viewIdChanged) {
      return
    }

    if (loadingRef.current && tableIdRef.current === tableId && viewIdRef.current === viewId) {
      return
    }

    prevTableIdRef.current = tableId
    prevViewIdRef.current = viewId
    loadingRef.current = true
    tableIdRef.current = tableId
    viewIdRef.current = viewId
    setLoading(true)

    async function loadTableData() {
      try {
        const supabase = createClient()

        const tableRes = await supabase
          .from("tables")
          .select("supabase_table")
          .eq("id", tableId)
          .maybeSingle()

        if (tableRes.data) {
          setTable(tableRes.data)
        }

        const tableFieldsRes = await supabase
          .from("table_fields")
          .select("*")
          .eq("table_id", tableId)
          .order("position", { ascending: true })

        const normalizedFields = asArray<TableField>(tableFieldsRes.data)
        setTableFields(normalizedFields)
      } catch (error) {
        console.error("Error loading table data:", error)
      } finally {
        setLoading(false)
        loadingRef.current = false
      }
    }

    loadTableData()
  }, [tableId, viewId])

  const isLoading = loading || metaLoading

  if (!tableId) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 text-sm p-4">
        <div className="text-center">
          <p className="mb-2">{isEditing ? "This block requires a table connection." : "No table connection"}</p>
          {isEditing && (
            <p className="text-xs text-gray-400">Configure the table in block settings.</p>
          )}
        </div>
      </div>
    )
  }

  // Convert sorts to ListView format
  const activeSorts = sortsConfig.length > 0
    ? sortsConfig.map((s: any) => ({
        field_name: s.field || '',
        direction: s.direction || 'asc',
      }))
    : viewSorts.map(s => ({
        field_name: s.field_name,
        direction: s.direction as 'asc' | 'desc',
      }))

  if (isLoading || !table) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 text-sm">
        Loading...
      </div>
    )
  }

  // Get list-specific field configuration
  const titleField = config.list_title_field || config.title_field || ''
  const subtitleFields = config.list_subtitle_fields || []
  const imageField = config.list_image_field || config.image_field || ''
  const pillFields = config.list_pill_fields || []
  const metaFields = config.list_meta_fields || []

  // Apply appearance settings
  const appearance = config.appearance || {}
  const blockStyle: React.CSSProperties = {
    backgroundColor: appearance.background_color,
    borderColor: appearance.border_color,
    borderWidth: appearance.border_width !== undefined ? `${appearance.border_width}px` : '1px',
    borderRadius: appearance.border_radius !== undefined ? `${appearance.border_radius}px` : '8px',
    padding: appearance.padding !== undefined ? `${appearance.padding}px` : '16px',
  }

  const showAddRecord = (appearance as any).show_add_record === true
  const permissions = config.permissions || {}
  const isViewOnly = permissions.mode === 'view'
  const allowInlineCreate = permissions.allowInlineCreate ?? true
  const canCreateRecord = !isViewOnly && allowInlineCreate

  const handleAddRecord = async () => {
    if (!showAddRecord || !canCreateRecord || isLoading || !table || !tableId) return
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from(table.supabase_table)
        .insert([{}])
        .select()
        .single()
      if (error) throw error
      const createdId = (data as any)?.id || (data as any)?.record_id
      if (!createdId) return
      if (onRecordClick) {
        onRecordClick(String(createdId))
      } else {
        window.location.href = `/tables/${tableId}/records/${createdId}`
      }
    } catch (error) {
      console.error('Failed to create record:', error)
      alert('Failed to create record. Please try again.')
    }
  }

  // Check if title field is configured
  if (!titleField && !isEditing) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 text-sm p-4">
        <div className="text-center">
          <p className="mb-2">List view requires a title field</p>
          <p className="text-xs text-gray-400">Configure the title field in block settings.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full w-full overflow-auto" style={blockStyle}>
      {((appearance.show_title !== false && (appearance.title || config.title)) || showAddRecord) && (
        <div
          className="mb-4 pb-2 border-b flex items-center justify-between gap-3"
          style={{
            backgroundColor: appearance.header_background,
            color: appearance.header_text_color || appearance.title_color,
          }}
        >
          <div className="min-w-0 flex-1">
            {(appearance.show_title !== false && (appearance.title || config.title)) && (
              <h3 className="text-lg font-semibold truncate">{appearance.title || config.title}</h3>
            )}
          </div>
          {showAddRecord && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleAddRecord}
              disabled={!canCreateRecord || isLoading || !table || !tableId}
              title={!canCreateRecord ? 'Adding records is disabled for this block' : 'Add a new record'}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add record
            </Button>
          )}
        </div>
      )}
      <ListView
        tableId={tableId}
        viewId={viewId || undefined}
        supabaseTableName={table.supabase_table}
        tableFields={safeTableFields}
        filters={allFilters}
        sorts={activeSorts}
        groupBy={groupBy}
        searchQuery=""
        onRecordClick={onRecordClick}
        showAddRecord={showAddRecord}
        canCreateRecord={canCreateRecord}
        titleField={titleField}
        subtitleFields={subtitleFields}
        imageField={imageField}
        pillFields={pillFields}
        metaFields={metaFields}
      />
    </div>
  )
}
