import { createClient } from "@/lib/supabase/server"
import Link from "next/link"
import GridViewWrapper from "@/components/grid/GridViewWrapper"
import FormView from "@/components/views/FormView"
import KanbanView from "@/components/views/KanbanView"
import CalendarView from "@/components/views/CalendarView"
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

    // Get view fields, filters, sorts, and config dynamically
    const [viewFieldsRes, viewFiltersRes, viewSortsRes] = await Promise.all([
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
        .eq("view_id", params.viewId)
        .order("order_index", { ascending: true }),
    ])

    const viewFields = viewFieldsRes.data || []
    const viewFilters = viewFiltersRes.data || []
    const viewSorts = viewSortsRes.data || []
    
    // Get groupBy from view config
    const groupBy = (view.config as { groupBy?: string })?.groupBy

    return (
      <WorkspaceShellWrapper title={view.name}>
        <div>
          <div className="mb-6">
            <Link
              href={`/tables/${params.tableId}`}
              className="text-sm text-muted-foreground hover:text-foreground mb-2 inline-block"
            >
              ← Back to {table.name}
            </Link>
            <h1 className="text-2xl font-bold mt-2">{view.name}</h1>
            <p className="text-muted-foreground mt-1">
              {table.name} • {view.type} view
            </p>
          </div>

          <div className="space-y-6">
            <div>
              {view.type === "grid" && (
                <GridViewWrapper
                  tableId={params.tableId}
                  viewId={params.viewId}
                  supabaseTableName={table.supabase_table}
                  viewFields={viewFields}
                  initialFilters={viewFilters}
                  initialSorts={viewSorts}
                  initialGroupBy={groupBy}
                />
              )}
              {view.type === "form" && (
                <FormView
                  tableId={params.tableId}
                  viewId={params.viewId}
                  fieldIds={viewFields.map((f) => f.field_name)}
                />
              )}
              {view.type === "kanban" && (
                <KanbanView
                  tableId={params.tableId}
                  viewId={params.viewId}
                  groupingFieldId={viewFields[0]?.field_name || ""}
                  fieldIds={viewFields.map((f) => f.field_name)}
                />
              )}
              {view.type === "calendar" && (
                <CalendarView
                  tableId={params.tableId}
                  viewId={params.viewId}
                  dateFieldId={viewFields[0]?.field_name || ""}
                  fieldIds={viewFields.map((f) => f.field_name)}
                />
              )}
            </div>
          </div>
        </div>
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
