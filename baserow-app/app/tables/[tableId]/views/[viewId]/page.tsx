import { createClient } from "@/lib/supabase/server"
import Link from "next/link"
import GridView from "@/components/views/GridView"
import FormView from "@/components/views/FormView"
import KanbanView from "@/components/views/KanbanView"
import CalendarView from "@/components/views/CalendarView"
import InterfacePage from "@/components/views/InterfacePage"
import { getTable } from "@/lib/crud/tables"
import { getView } from "@/lib/crud/views"
import { getViewBlocks } from "@/lib/crud/view-blocks"
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
      return <div>Table not found</div>
    }

    const view = await getView(params.viewId).catch(() => null)
    if (!view) {
      return <div>View not found</div>
    }

    // For page type views, use InterfacePage (full width, no container)
    if (view.type === "page") {
      return (
        <div className="w-full h-full">
          <InterfacePage viewId={params.viewId} />
        </div>
      )
    }

    // Get view fields to determine which fields to show
    const { data: viewFields, error: viewFieldsError } = await supabase
      .from("view_fields")
      .select("field_id")
      .eq("view_id", params.viewId)
      .order("order_index", { ascending: true })

    if (viewFieldsError) {
      console.error("Error loading view fields:", viewFieldsError)
    }

    const fieldIds = viewFields?.map((vf) => vf.field_id) || []

    return (
      <div className="container mx-auto p-6">
        <div className="mb-6">
          <Link
            href={`/tables/${params.tableId}`}
            className="text-sm text-muted-foreground hover:text-foreground mb-2 inline-block"
          >
            ← Back to {table.name}
          </Link>
          <h1 className="text-3xl font-bold mt-2">{view.name}</h1>
          <p className="text-muted-foreground mt-1">
            {table.name} • {view.type} view
          </p>
        </div>

        <div className="space-y-6">
          <div>
            {view.type === "grid" && (
              <GridView
                tableId={params.tableId}
                viewId={params.viewId}
                fieldIds={fieldIds}
              />
            )}
            {view.type === "form" && (
              <FormView
                tableId={params.tableId}
                viewId={params.viewId}
                fieldIds={fieldIds}
              />
            )}
            {view.type === "kanban" && (
              <KanbanView
                tableId={params.tableId}
                viewId={params.viewId}
                groupingFieldId={fieldIds[0] || ""}
                fieldIds={fieldIds}
              />
            )}
            {view.type === "calendar" && (
              <CalendarView
                tableId={params.tableId}
                viewId={params.viewId}
                dateFieldId={fieldIds[0] || ""}
                fieldIds={fieldIds}
              />
            )}
          </div>
        </div>
      </div>
    )
  } catch (error) {
    console.error("Error rendering view page:", error)
    return <div>An error occurred while loading this view.</div>
  }
}
