import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from "@/lib/supabase/server"
import { isAdmin } from "@/lib/roles"
import AirtableViewPage from "@/components/grid/AirtableViewPage"
import NonGridViewWrapper from "@/components/grid/NonGridViewWrapper"
import InterfacePage from "@/components/views/InterfacePage"
import WorkspaceShellWrapper from "@/components/layout/WorkspaceShellWrapper"
import { getTable } from "@/lib/crud/tables"
import { getView } from "@/lib/crud/views"
import { Button } from "@/components/ui/button"
import type { View } from "@/types/database"
import { normalizeUuid } from "@/lib/utils/ids"

export default async function ViewPage({
  params,
}: {
  params: { tableId: string; viewId: string }
}) {
  // Security: Only admins can access Core Data (tables/views)
  const admin = await isAdmin()
  if (!admin) {
    // Redirect to first available interface
    const supabase = await createClient()
    const { data: firstInterface } = await supabase
      .from('views')
      .select('id')
      .eq('type', 'interface')
      .or('is_admin_only.is.null,is_admin_only.eq.false')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    
    if (firstInterface) {
      redirect(`/pages/${firstInterface.id}`)
    } else {
      redirect('/')
    }
  }
  try {
    const supabase = await createClient()

    // Be defensive: in some contexts IDs may arrive as "<uuid>:<index>".
    // Supabase expects strict UUID strings for uuid-typed columns, so reject invalid IDs early.
    const tableId = normalizeUuid(params.tableId)
    const viewId = normalizeUuid(params.viewId)

    if (!tableId || !viewId) {
      return (
        <WorkspaceShellWrapper title="Invalid view">
          <div>Invalid view.</div>
        </WorkspaceShellWrapper>
      )
    }
    
    const table = await getTable(tableId).catch(() => null)
    if (!table) {
      return (
        <WorkspaceShellWrapper title="Table not found">
          <div>Table not found</div>
        </WorkspaceShellWrapper>
      )
    }

    const view = await getView(viewId).catch(() => null)
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
            <InterfacePage viewId={viewId} />
          </div>
        </WorkspaceShellWrapper>
      )
    }

    // Get view fields, filters, sorts, grid settings, and table fields dynamically
    // Use Promise.allSettled to handle missing tables gracefully
    const [viewFieldsRes, viewFiltersRes, viewSortsRes, gridSettingsRes, tableFieldsRes] = await Promise.allSettled([
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
        .select("id, field_name, direction, order_index")
        .eq("view_id", viewId)
        .order("order_index", { ascending: true }),
      supabase
        .from("grid_view_settings")
        .select("group_by_field, group_by_rules")
        .eq("view_id", viewId)
        .maybeSingle(),
      supabase
        .from("table_fields")
        .select("*")
        .eq("table_id", tableId)
        .order("position", { ascending: true }),
    ])

    const viewFields = viewFieldsRes.status === 'fulfilled' && !viewFieldsRes.value.error ? (viewFieldsRes.value.data || []) : []
    const viewFilters = viewFiltersRes.status === 'fulfilled' && !viewFiltersRes.value.error ? (viewFiltersRes.value.data || []) : []
    const viewSorts = viewSortsRes.status === 'fulfilled' && !viewSortsRes.value.error ? (viewSortsRes.value.data || []) : []
    const tableFields = tableFieldsRes.status === 'fulfilled' && !tableFieldsRes.value.error ? (tableFieldsRes.value.data || []) : []
    
    // Get groupBy from grid_view_settings (fallback to view.config for backward compatibility)
    const gridSettings = gridSettingsRes.status === 'fulfilled' && !gridSettingsRes.value.error ? gridSettingsRes.value.data : null
    const groupBy = gridSettings?.group_by_field || (view.config as { groupBy?: string })?.groupBy
    const groupByRules = gridSettings?.group_by_rules || null
    
    // For Kanban views, get group field from settings or config
    const kanbanGroupField = view.type === "kanban" 
      ? (groupBy || (view.config as { kanbanGroupField?: string })?.kanbanGroupField)
      : undefined

    // For horizontal_grouped views, get group field and rules from settings
    const horizontalGroupedGroupField = view.type === "horizontal_grouped" ? groupBy : undefined
    const horizontalGroupedGroupRules = view.type === "horizontal_grouped" ? (groupByRules as any) : undefined

    return (
      <WorkspaceShellWrapper title={view.name}>
        {view.type === "grid" ? (
          <AirtableViewPage
            tableId={tableId}
            viewId={viewId}
            table={table}
            view={view}
            initialViewFields={viewFields}
            initialViewFilters={viewFilters}
            initialViewSorts={viewSorts}
            initialTableFields={tableFields}
            initialGroupBy={groupBy}
            initialGridSettings={gridSettings}
          />
        ) : view.type === "horizontal_grouped" ? (
          <NonGridViewWrapper
            viewType="horizontal_grouped"
            viewName={view.name}
            tableId={tableId}
            viewId={viewId}
            fieldIds={Array.isArray(viewFields) ? viewFields.map((f) => f.field_name).filter(Boolean) : []}
            groupingFieldId={horizontalGroupedGroupField}
            groupByRules={horizontalGroupedGroupRules}
            viewFilters={viewFilters}
            viewSorts={viewSorts}
            tableFields={tableFields}
          />
        ) : (
          <NonGridViewWrapper
            viewType={view.type as "form" | "kanban" | "calendar" | "timeline"}
            viewName={view.name}
            tableId={tableId}
            viewId={viewId}
            fieldIds={Array.isArray(viewFields) ? viewFields.map((f) => f.field_name).filter(Boolean) : []}
            groupingFieldId={kanbanGroupField}
            dateFieldId={
              view.type === "calendar" || view.type === "timeline"
                ? (Array.isArray(viewFields) && viewFields[0]?.field_name) || undefined
                : undefined
            }
          />
        )}
      </WorkspaceShellWrapper>
    )
  } catch (error: any) {
    // Don't catch redirect errors - let Next.js handle them
    // Next.js redirect() throws an error with digest property
    if (error?.digest?.startsWith('NEXT_REDIRECT') || error?.message?.includes('NEXT_REDIRECT')) {
      throw error // Re-throw redirect errors so Next.js can handle them
    }
    
    console.error("Error rendering view page:", error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    
    return (
      <WorkspaceShellWrapper title="Error">
        <div className="text-center py-12">
          <p className="text-destructive mb-2">An error occurred while loading this view.</p>
          <p className="text-sm text-muted-foreground mb-4">
            {errorMessage}
          </p>
          <Button asChild>
            <Link href={`/tables/${params.tableId}`}>Back to Table</Link>
          </Button>
        </div>
      </WorkspaceShellWrapper>
    )
  }
}
