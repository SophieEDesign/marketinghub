"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { PageBlock, ViewType } from "@/lib/interface/types"
import GridViewWrapper from "@/components/grid/GridViewWrapper"
import KanbanView from "@/components/views/KanbanView"
import CalendarView from "@/components/views/CalendarView"

interface GridBlockProps {
  block: PageBlock
  isEditing?: boolean
  pageTableId?: string | null // Table ID from the page
  pageId?: string | null // Page ID
}

export default function GridBlock({ block, isEditing = false, pageTableId = null, pageId = null }: GridBlockProps) {
  const { config } = block
  // Use page's tableId if block doesn't have one configured
  const tableId = config?.table_id || pageTableId
  const viewId = config?.view_id
  const viewType: ViewType = config?.view_type || 'grid'
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
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableId, viewId, viewType])

  async function loadData() {
    if (!tableId || !viewId) return

    setLoading(true)
    try {
      const supabase = createClient()

      // Use Promise.allSettled to handle missing tables gracefully
      const [tableRes, viewFieldsRes, viewFiltersRes, viewSortsRes, tableFieldsRes, viewRes] = await Promise.allSettled([
        supabase.from("tables").select("supabase_table").eq("id", tableId).maybeSingle(),
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
        supabase
          .from("table_fields")
          .select("*")
          .eq("table_id", tableId)
          .order("position", { ascending: true }),
        supabase.from("views").select("config").eq("id", viewId).maybeSingle(),
      ])

      if (tableRes.status === 'fulfilled') {
        if (tableRes.value.error) {
          // Handle 406 or other errors gracefully
          console.warn('Error loading table:', tableRes.value.error)
        } else if (tableRes.value.data) {
          setTable(tableRes.value.data)
        }
      }
      if (viewFieldsRes.status === 'fulfilled' && !viewFieldsRes.value.error && viewFieldsRes.value.data) setViewFields(viewFieldsRes.value.data)
      if (viewFiltersRes.status === 'fulfilled' && !viewFiltersRes.value.error && viewFiltersRes.value.data) setViewFilters(viewFiltersRes.value.data)
      if (viewSortsRes.status === 'fulfilled' && !viewSortsRes.value.error && viewSortsRes.value.data) setViewSorts(viewSortsRes.value.data)
      if (tableFieldsRes.status === 'fulfilled' && !tableFieldsRes.value.error && tableFieldsRes.value.data) setTableFields(tableFieldsRes.value.data)
      if (viewRes.status === 'fulfilled' && !viewRes.value.error && viewRes.value.data?.config) {
        const config = viewRes.value.data.config as { groupBy?: string }
        setGroupBy(config.groupBy)
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
          <p className="mb-2">{isEditing ? "This block isn't connected to a table yet." : "No table connection"}</p>
          {isEditing && (
            <p className="text-xs text-gray-400">Configure the table in block settings, or ensure the page has a table connection.</p>
          )}
        </div>
      </div>
    )
  }

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
    const fieldIds = viewFields.map(f => f.field_name)
    const groupingFieldId = config.group_by || viewFields[0]?.field_name || ''
    const dateFieldId = viewFields.find(f => f.field_name.toLowerCase().includes('date'))?.field_name || viewFields[0]?.field_name || ''

    switch (viewType) {
      case 'kanban':
        return (
          <KanbanView
            tableId={tableId!}
            viewId={viewId || ''}
            groupingFieldId={groupingFieldId}
            fieldIds={fieldIds}
            tableFields={tableFields}
          />
        )
      case 'calendar':
        return (
          <CalendarView
            tableId={tableId!}
            viewId={viewId || ''}
            dateFieldId={dateFieldId}
            fieldIds={fieldIds}
            tableFields={tableFields}
          />
        )
      case 'gallery':
        // Gallery view - similar to grid but card-based
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <p className="text-gray-500">Gallery view coming soon</p>
          </div>
        )
      case 'timeline':
        // Timeline view
        return (
          <div className="space-y-4">
            <p className="text-gray-500">Timeline view coming soon</p>
          </div>
        )
      case 'grid':
      default:
        return (
          <GridViewWrapper
            tableId={tableId!}
            viewId={viewId || ''}
            supabaseTableName={table.supabase_table}
            viewFields={viewFields}
            initialFilters={viewFilters}
            initialSorts={viewSorts}
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
