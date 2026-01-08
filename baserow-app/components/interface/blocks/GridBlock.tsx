"use client"

import { useEffect, useState, useMemo, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import type { PageBlock, ViewType } from "@/lib/interface/types"
import GridViewWrapper from "@/components/grid/GridViewWrapper"
import CalendarView from "@/components/views/CalendarView"
import KanbanView from "@/components/views/KanbanView"
import TimelineView from "@/components/views/TimelineView"
import { mergeFilters, type FilterConfig } from "@/lib/interface/filters"
import { useViewMeta } from "@/hooks/useViewMeta"

interface GridBlockProps {
  block: PageBlock
  isEditing?: boolean
  pageTableId?: string | null // Table ID from the page
  pageId?: string | null // Page ID
  filters?: FilterConfig[] // Page-level or filter block filters
}

export default function GridBlock({ block, isEditing = false, pageTableId = null, pageId = null, filters = [] }: GridBlockProps) {
  const { config } = block
  // Grid block table_id resolution: use config.table_id first, fallback to pageTableId
  // This ensures calendar/list/kanban pages work even if table_id isn't explicitly set in block config
  const tableId = config?.table_id || pageTableId || config?.base_table || null
  const viewId = config?.view_id
  const viewType: ViewType = config?.view_type || 'grid'
  // Visible fields from config (required) - ensure it's always an array
  const visibleFieldsConfig = Array.isArray(config?.visible_fields) 
    ? config.visible_fields 
    : (config?.visible_fields ? [config.visible_fields] : [])
  const blockBaseFilters = Array.isArray(config?.filters) ? config.filters : []
  const sortsConfig = Array.isArray(config?.sorts) ? config.sorts : []
  
  // Merge filters with proper precedence: block base filters + filter block filters
  const allFilters = useMemo(() => {
    return mergeFilters(blockBaseFilters, filters, [])
  }, [blockBaseFilters, filters])
  const [loading, setLoading] = useState(true)
  const [table, setTable] = useState<{ supabase_table: string } | null>(null)
  const [tableFields, setTableFields] = useState<any[]>([])
  const [groupBy, setGroupBy] = useState<string | undefined>(undefined)
  
  // Use cached metadata hook (serialized, no parallel requests)
  const { metadata: viewMeta, loading: metaLoading } = useViewMeta(viewId, tableId)
  
  // Convert cached metadata to component state format
  const viewFields = useMemo(() => {
    if (!viewMeta?.fields) return []
    return viewMeta.fields.map(f => ({
      field_name: f.field_name,
      visible: f.visible,
      position: f.position,
    }))
  }, [viewMeta?.fields])
  
  const viewFilters = useMemo(() => {
    if (!viewMeta?.filters) return []
    return viewMeta.filters.map(f => ({
      id: f.id || '',
      field_name: f.field_name,
      operator: f.operator,
      value: f.value,
    }))
  }, [viewMeta?.filters])
  
  const viewSorts = useMemo(() => {
    if (!viewMeta?.sorts) return []
    return viewMeta.sorts.map(s => ({
      id: s.id || '',
      field_name: s.field_name,
      direction: s.direction,
    }))
  }, [viewMeta?.sorts])

  // Track loading state to prevent concurrent loads
  const loadingRef = useRef(false)
  const tableIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!tableId) {
      setLoading(false)
      return
    }

    // Skip if already loading the same table
    if (loadingRef.current && tableIdRef.current === tableId) {
      return
    }

    loadingRef.current = true
    tableIdRef.current = tableId
    setLoading(true)

    async function loadTableData() {
      try {
        const supabase = createClient()

        // CRITICAL: Serialize table and table_fields requests (no parallel Promise.all)
        // Load table first
        const tableRes = await supabase
          .from("tables")
          .select("supabase_table")
          .eq("id", tableId)
          .maybeSingle()

        if (tableRes.data) {
          setTable(tableRes.data)
        }

        // Then load table_fields
        const tableFieldsRes = await supabase
          .from("table_fields")
          .select("*")
          .eq("table_id", tableId)
          .order("position", { ascending: true })

        if (tableFieldsRes.data) {
          setTableFields(tableFieldsRes.data)
        }

        // Load view config if viewId provided (separate from metadata)
        if (viewId) {
          const viewRes = await supabase
            .from("views")
            .select("config")
            .eq("id", viewId)
            .maybeSingle()

          if (viewRes.data?.config) {
            const viewConfig = viewRes.data.config as { groupBy?: string }
            setGroupBy(viewConfig.groupBy)
          }
        }
      } catch (error) {
        console.error("Error loading table data:", error)
        // CRITICAL: Do NOT retry automatically on network failure
        // Keep existing data if available
      } finally {
        setLoading(false)
        loadingRef.current = false
      }
    }

    loadTableData()
  }, [tableId, viewId])

  // Combine loading states
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

  // Determine visible fields: use config.visible_fields if provided, otherwise use view_fields
  // Ensure all values are arrays to prevent runtime errors
  const safeViewFields = Array.isArray(viewFields) ? viewFields : []
  const visibleFields = visibleFieldsConfig.length > 0
    ? visibleFieldsConfig.map((fieldName: string) => {
        const field = tableFields.find(f => f.name === fieldName || f.id === fieldName)
        return field ? { field_name: field.name, visible: true, position: 0 } : null
      }).filter(Boolean) as Array<{ field_name: string; visible: boolean; position: number }>
    : safeViewFields.filter(f => f && f.visible)

  // Convert merged filters to legacy format for GridViewWrapper (backward compatibility)
  const activeFilters = allFilters.map((f, idx) => ({
    id: f.field || `filter-${idx}`,
    field_name: f.field,
    operator: f.operator,
    value: f.value,
  }))

  const activeSorts = sortsConfig.length > 0
    ? sortsConfig.map((s: any) => ({
        id: s.field || '',
        field_name: s.field || '',
        direction: s.direction || 'asc',
      }))
    : viewSorts

  if (isLoading || !table) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 text-sm">
        Loading...
      </div>
    )
  }

  // Apply appearance settings
  const appearance = config.appearance || {}
  const blockStyle: React.CSSProperties = {
    backgroundColor: appearance.background_color,
    borderColor: appearance.border_color,
    borderWidth: appearance.border_width !== undefined ? `${appearance.border_width}px` : '1px',
    borderRadius: appearance.border_radius !== undefined ? `${appearance.border_radius}px` : '8px',
    padding: appearance.padding !== undefined ? `${appearance.padding}px` : '16px',
  }

  // Render based on view type
  const renderView = () => {
    const fieldIds = visibleFields.map(f => f.field_name)
    
    switch (viewType) {
      case 'calendar': {
        // Calendar requires tableId - if missing, show error or let CalendarView handle it
        if (!tableId) {
          return (
            <div className="h-full flex items-center justify-center text-gray-400 text-sm p-4">
              <div className="text-center">
                <p className="mb-2">{isEditing ? "Calendar view requires a table connection." : "No table configured"}</p>
                {isEditing && (
                  <p className="text-xs text-gray-400">Configure a table in block settings.</p>
                )}
              </div>
            </div>
          )
        }
        
        // Calendar will load its own config from the view, but we can provide a fallback dateFieldId
        // Find ALL date fields in the table (not just visibleFields) to ensure we can find the configured field
        const allDateFieldsInTable = tableFields
          .filter(field => field.type === 'date')
          .map(field => ({ field }))
        
        // Prioritize fields with names like 'date', 'date_to', 'date_due' over 'created', 'created_at', 'updated_at'
        const preferredDateField = allDateFieldsInTable.find(({ field }) => {
          const name = field.name.toLowerCase()
          return name.includes('date') && !name.includes('created') && !name.includes('updated')
        })
        
        const defaultDateField = preferredDateField || allDateFieldsInTable[0]
        
        // Resolve dateFieldId as fallback - prefer field name over ID since data uses field names as keys
        // The CalendarView component will load the view config and use that instead
        let dateFieldId = ''
        
        // Check block config first
        const dateFieldFromConfig = config.calendar_date_field || config.start_date_field
        
        if (dateFieldFromConfig) {
          // If config has a field ID/name, find the actual field to validate it exists and is a date field
          const resolvedField = tableFields.find(tf => 
            (tf.name === dateFieldFromConfig || tf.id === dateFieldFromConfig) && tf.type === 'date'
          )
          if (resolvedField) {
            dateFieldId = resolvedField.name
          }
        }
        
        // If config field not found or invalid, try to use a default date field
        if (!dateFieldId && defaultDateField) {
          dateFieldId = defaultDateField.field.name
        }
        
        // CalendarView will load view config and use that, so we don't need to error here
        // Just pass the fallback dateFieldId in case view config doesn't have one
        // Pass tableId as string (not null) since we've validated it above
        
        return (
          <CalendarView
            tableId={tableId}
            viewId={viewId || ''}
            dateFieldId={dateFieldId}
            fieldIds={fieldIds}
            tableFields={tableFields}
            filters={allFilters}
            blockConfig={config} // Pass block config so CalendarView can read date_field from page settings
            // onRecordClick is handled internally by CalendarView using modal
          />
        )
      }
      
      case 'kanban': {
        // Kanban requires a tableId and a grouping field (typically a select/single_select field)
        if (!tableId) {
          return (
            <div className="h-full flex items-center justify-center text-gray-400 text-sm p-4">
              <div className="text-center">
                <p className="mb-2">{isEditing ? "Kanban view requires a table connection." : "No table configured"}</p>
                {isEditing && (
                  <p className="text-xs text-gray-400">Configure a table in block settings.</p>
                )}
              </div>
            </div>
          )
        }
        
        const groupByFieldFromConfig = config.group_by_field || config.kanban_group_field
        const groupByFieldFromFields = visibleFields.find(f => {
          const field = tableFields.find(tf => tf.name === f.field_name || tf.id === f.field_name)
          return field && (field.type === 'select' || field.type === 'single_select')
        })
        const groupByFieldId = groupByFieldFromConfig || groupByFieldFromFields?.field_name || ''
        
        if (!groupByFieldId) {
          return (
            <div className="h-full flex items-center justify-center text-gray-400 text-sm p-4">
              <div className="text-center">
                <p className="mb-2">{isEditing ? "Kanban view requires a grouping field." : "No grouping field configured"}</p>
                {isEditing && (
                  <p className="text-xs text-gray-400">Configure a select field for grouping in block settings.</p>
                )}
              </div>
            </div>
          )
        }
        
        return (
          <KanbanView
            tableId={tableId}
            viewId={viewId || ''}
            groupingFieldId={groupByFieldId}
            fieldIds={fieldIds}
            searchQuery=""
            tableFields={tableFields}
          />
        )
      }
      
      case 'timeline': {
        // Timeline requires a date field
        const dateFieldFromConfig = config.timeline_date_field || config.start_date_field || config.calendar_date_field
        const dateFieldFromFields = visibleFields.find(f => {
          const field = tableFields.find(tf => tf.name === f.field_name || tf.id === f.field_name)
          return field && field.type === 'date'
        })
        const dateFieldId = dateFieldFromConfig || dateFieldFromFields?.field_name || ''
        
        if (!dateFieldId) {
          return (
            <div className="h-full flex items-center justify-center text-gray-400 text-sm p-4">
              <div className="text-center">
                <p className="mb-2">{isEditing ? "Timeline view requires a date field." : "No date field configured"}</p>
                {isEditing && (
                  <p className="text-xs text-gray-400">Configure a date field in block settings.</p>
                )}
              </div>
            </div>
          )
        }
        
        return (
          <TimelineView
            tableId={tableId!}
            viewId={viewId || ''}
            dateFieldId={dateFieldId}
            fieldIds={fieldIds}
            searchQuery=""
            tableFields={tableFields}
          />
        )
      }
      
      case 'gallery': {
        // Gallery view - show unsupported state for now
        return (
          <div className="h-full flex items-center justify-center text-gray-400 text-sm p-4">
            <div className="text-center">
              <p className="mb-2">Gallery view is not yet available</p>
              {isEditing && (
                <p className="text-xs text-gray-400">Gallery view will be available in a future update.</p>
              )}
            </div>
          </div>
        )
      }
      
      case 'grid':
      default:
        return (
          <GridViewWrapper
            tableId={tableId!}
            viewId={viewId || ''}
            supabaseTableName={table.supabase_table}
            viewFields={visibleFields}
            initialFilters={activeFilters}
            standardizedFilters={allFilters}
            initialSorts={activeSorts}
            initialGroupBy={groupBy}
            initialTableFields={tableFields}
            isEditing={isEditing}
            onRecordClick={(recordId) => {
              if (tableId) {
                window.location.href = `/tables/${tableId}/records/${recordId}`
              }
            }}
            appearance={appearance}
          />
        )
    }
  }

  return (
    <div className="h-full w-full overflow-auto" style={blockStyle}>
      {appearance.show_title !== false && (appearance.title || config.title) && (
        <div
          className="mb-4 pb-2 border-b"
          style={{
            backgroundColor: appearance.header_background,
            color: appearance.header_text_color || appearance.title_color,
          }}
        >
          <h3 className="text-lg font-semibold">{appearance.title || config.title}</h3>
        </div>
      )}
      {renderView()}
    </div>
  )
}
