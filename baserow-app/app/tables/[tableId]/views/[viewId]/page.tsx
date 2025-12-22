import { createClient } from "@/lib/supabase/server"
import AirtableViewPage from "@/components/grid/AirtableViewPage"
import NonGridViewWrapper from "@/components/grid/NonGridViewWrapper"
import InterfacePage from "@/components/views/InterfacePage"
import WorkspaceShellWrapper from "@/components/layout/WorkspaceShellWrapper"
import { getTable } from "@/lib/crud/tables"
import { getView } from "@/lib/crud/views"
import type { View } from "@/types/database"

export default async function ViewPage({
  params,
}: {
  params: { tableId: string; viewId: string }
}) {
  // Authentication disabled for testing
  try {
    const supabase = await createClient()
    
    const table = await getTable(params.tableId).catch(() => null)
    if (!table) {
      return (
        <WorkspaceShellWrapper title="Table not found">
          <div>Table not found</div>
        </WorkspaceShellWrapper>
      )
    }

    const view = await getView(params.viewId).catch(() => null)
    if (!view) {
      return (
        <WorkspaceShellWrapper title="View not found">
          <div>View not found</div>
        </WorkspaceShellWrapper>
      )
    }

    // For page type views, use InterfacePage (full width, no container)
    if (view.type === "page") {
      return (
        <WorkspaceShellWrapper title={view.name}>
          <div className="w-full h-full -m-6">
            <InterfacePage viewId={params.viewId} />
          </div>
        </WorkspaceShellWrapper>
      )
    }

    // Get view fields, filters, sorts, config, and table fields dynamically
    // Use Promise.allSettled to handle missing tables gracefully
    const [viewFieldsRes, viewFiltersRes, viewSortsRes, tableFieldsRes] = await Promise.allSettled([
      supabase
        .from("view_fields")
        .select("field_name, visible, position")
        .eq("view_id", params.viewId)
        .order("position", { ascending: true }),
      supabase
        .from("view_filters")
        .select("id, field_name, operator, value")
        .eq("view_id", params.viewId),
      supabase
        .from("view_sorts")
        .select("id, field_name, direction")
        .eq("view_id", params.viewId),
      supabase
        .from("table_fields")
        .select("*")
        .eq("table_id", params.tableId)
        .order("position", { ascending: true }),
    ])

    const viewFields = viewFieldsRes.status === 'fulfilled' && !viewFieldsRes.value.error ? (viewFieldsRes.value.data || []) : []
    const viewFilters = viewFiltersRes.status === 'fulfilled' && !viewFiltersRes.value.error ? (viewFiltersRes.value.data || []) : []
    const viewSorts = viewSortsRes.status === 'fulfilled' && !viewSortsRes.value.error ? (viewSortsRes.value.data || []) : []
    const tableFields = tableFieldsRes.status === 'fulfilled' && !tableFieldsRes.value.error ? (tableFieldsRes.value.data || []) : []
    
    // Get groupBy from view config
    const groupBy = (view.config as { groupBy?: string })?.groupBy

    return (
      <WorkspaceShellWrapper title={view.name}>
        {view.type === "grid" ? (
          <AirtableViewPage
            tableId={params.tableId}
            viewId={params.viewId}
            table={table}
            view={view}
            initialViewFields={viewFields}
            initialViewFilters={viewFilters}
            initialViewSorts={viewSorts}
            initialTableFields={tableFields}
          />
        ) : (
          <NonGridViewWrapper
            viewType={view.type as "form" | "kanban" | "calendar"}
            viewName={view.name}
            tableId={params.tableId}
            viewId={params.viewId}
            fieldIds={viewFields.map((f) => f.field_name)}
            groupingFieldId={view.type === "kanban" ? viewFields[0]?.field_name : undefined}
            dateFieldId={view.type === "calendar" ? viewFields[0]?.field_name : undefined}
          />
        )}
      </WorkspaceShellWrapper>
    )
  } catch (error) {
    console.error("Error rendering view page:", error)
    return (
      <WorkspaceShellWrapper title="Error">
        <div>An error occurred while loading this view.</div>
      </WorkspaceShellWrapper>
    )
  }
}
