"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { PageBlock, ViewType } from "@/lib/interface/types"
import GridViewWrapper from "@/components/grid/GridViewWrapper"
import CalendarView from "@/components/views/CalendarView"
// TODO: Kanban, Timeline, Gallery - not yet implemented
// import KanbanView from "@/components/views/KanbanView"

interface GridBlockProps {
  block: PageBlock
  isEditing?: boolean
  pageTableId?: string | null // Table ID from the page
  pageId?: string | null // Page ID
}

export default function GridBlock({ block, isEditing = false, pageTableId = null, pageId = null }: GridBlockProps) {
  const { config } = block
  // Grid block MUST have table_id configured - no fallback to page table
  const tableId = config?.table_id
  const viewId = config?.view_id
  const viewType: ViewType = config?.view_type || 'grid'
  // Visible fields from config (required)
  const visibleFieldsConfig = config?.visible_fields || []
  const filtersConfig = config?.filters || []
  const sortsConfig = config?.sorts || []
  const [loading, setLoading] = useState(true)
  const [table, setTable] = useState<{ supabase_table: string } | null>(null)
  const [viewFields, setViewFields] = useState<Array<{ field_name: string; visible: boolean; position: number }>>([])
  const [viewFilters, setViewFilters] = useState<Array<{ id: string; field_name: string; operator: string; value?: string }>>([])
  const [viewSorts, setViewSorts] = useState<Array<{ id: string; field_name: string; direction: string }>>([])
  const [tableFields, setTableFields] = useState<any[]>([])
  const [groupBy, setGroupBy] = useState<string | undefined>(undefined)

  useEffect(() => {
    if (tableId) {
      loadData()
    } else {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableId, viewId, viewType, visibleFieldsConfig])

  async function loadData() {
    if (!tableId) return

    setLoading(true)
    try {
      const supabase = createClient()

      // Load table and table_fields (required for schema)
      const [tableRes, tableFieldsRes] = await Promise.allSettled([
        supabase.from("tables").select("supabase_table").eq("id", tableId).maybeSingle(),
        supabase
          .from("table_fields")
          .select("*")
          .eq("table_id", tableId)
          .order("position", { ascending: true }),
      ])

      if (tableRes.status === 'fulfilled' && tableRes.value.data) {
        setTable(tableRes.value.data)
      }
      if (tableFieldsRes.status === 'fulfilled' && tableFieldsRes.value.data) {
        setTableFields(tableFieldsRes.value.data)
      }

      // Load view-specific data if view_id is provided
      if (viewId) {
        const [viewFieldsRes, viewFiltersRes, viewSortsRes, viewRes] = await Promise.allSettled([
          supabase
            .from("view_fields")
            .select("field_name, visible, position")
            .eq("view_id", viewId)
            .order("position", { ascending: true }),
          supabase
            .from("view_filters")
            .select("id, field_name, operator, value")
            .eq("view_id", viewId),
          supabase
            .from("view_sorts")
            .select("id, field_name, direction")
            .eq("view_id", viewId),
          supabase.from("views").select("config").eq("id", viewId).maybeSingle(),
        ])

        if (viewFieldsRes.status === 'fulfilled' && viewFieldsRes.value.data) {
          setViewFields(viewFieldsRes.value.data)
        }
        if (viewFiltersRes.status === 'fulfilled' && viewFiltersRes.value.data) {
          setViewFilters(viewFiltersRes.value.data)
        }
        if (viewSortsRes.status === 'fulfilled' && viewSortsRes.value.data) {
          setViewSorts(viewSortsRes.value.data)
        }
        if (viewRes.status === 'fulfilled' && viewRes.value.data?.config) {
          const viewConfig = viewRes.value.data.config as { groupBy?: string }
          setGroupBy(viewConfig.groupBy)
        }
      }
    } catch (error) {
      console.error("Error loading grid data:", error)
    } finally {
      setLoading(false)
    }
  }

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
  const visibleFields = visibleFieldsConfig.length > 0
    ? visibleFieldsConfig.map((fieldName: string) => {
        const field = tableFields.find(f => f.name === fieldName || f.id === fieldName)
        return field ? { field_name: field.name, visible: true, position: 0 } : null
      }).filter(Boolean) as Array<{ field_name: string; visible: boolean; position: number }>
    : viewFields.filter(f => f.visible)

  // Use config filters/sorts if provided, otherwise use view filters/sorts
  const activeFilters = filtersConfig.length > 0
    ? filtersConfig.map((f: any) => ({
        id: f.field || '',
        field_name: f.field || '',
        operator: f.operator || 'eq',
        value: f.value,
      }))
    : viewFilters

  const activeSorts = sortsConfig.length > 0
    ? sortsConfig.map((s: any) => ({
        id: s.field || '',
        field_name: s.field || '',
        direction: s.direction || 'asc',
      }))
    : viewSorts

  if (loading || !table) {
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
        // Calendar requires a valid date field
        // Try to find a date field from config or visible fields
        const dateFieldFromConfig = config.calendar_date_field || config.start_date_field
        const dateFieldFromFields = visibleFields.find(f => {
          const field = tableFields.find(tf => tf.name === f.field_name || tf.id === f.field_name)
          return field && (field.type === 'date' || field.type === 'datetime' || field.type === 'timestamp')
        })
        const dateFieldId = dateFieldFromConfig || dateFieldFromFields?.field_name || ''
        
        return (
          <CalendarView
            tableId={tableId!}
            viewId={viewId || ''}
            dateFieldId={dateFieldId}
            fieldIds={fieldIds}
            tableFields={tableFields}
          />
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
            initialSorts={activeSorts}
            initialGroupBy={groupBy}
            initialTableFields={tableFields}
            isEditing={isEditing}
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
