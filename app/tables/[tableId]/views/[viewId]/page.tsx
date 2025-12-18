import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase'
import { checkViewAccess } from '@/lib/permissions'
import { loadView, loadViewFields } from '@/lib/views'
import { loadRows } from '@/lib/data'
import { loadViewBlocks } from '@/lib/blocks'
import ViewTopBar from '@/components/views/ViewTopBar'
import type { TableField } from '@/baserow-app/types/fields'
import AirtableGridView from '@/baserow-app/components/grid/AirtableGridView'
import CalendarView from '@/components/calendar/CalendarView'
import KanbanView from '@/components/views/KanbanView'
import FormView from '@/components/views/FormView'
import InterfacePage from '@/components/views/InterfacePage'
import type { ViewType } from '@/types/database'

export default async function ViewPage({
  params,
}: {
  params: { tableId: string; viewId: string }
}) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Load table
  const { data: table } = await supabase
    .from('tables')
    .select('id, name, supabase_table')
    .eq('id', params.tableId)
    .single()

  if (!table) {
    return <div>Table not found</div>
  }

  // Load view
  const view = await loadView(params.viewId)
  if (!view) {
    return <div>View not found</div>
  }

  // Check view access
  const hasAccess = await checkViewAccess(view)
  if (!hasAccess) {
    return <div>Access denied</div>
  }

  // Load view configuration
  const viewFields = await loadViewFields(params.viewId)

  // Load table fields for grid view
  let tableFields: TableField[] = []
  if (view.type === 'grid') {
    const { data: fieldsData } = await supabase
      .from('table_fields')
      .select('*')
      .eq('table_id', params.tableId)
      .order('position', { ascending: true })
    tableFields = (fieldsData || []) as TableField[]
  }

  // Load data for non-page views
  let rowsData = null
  if (view.type !== 'gallery' && view.type !== 'page') {
    rowsData = await loadRows({
      tableId: params.tableId,
      viewId: params.viewId,
    })
  }

  // Load blocks for page views
  const blocks = view.type === 'page' ? await loadViewBlocks(params.viewId) : []

  // For interface pages, use full-width layout
  if (view.type === 'page') {
    return (
      <div className="flex flex-col h-screen">
        <ViewTopBar
          viewId={params.viewId}
          viewName={view.name}
          viewType={view.type as ViewType}
          tableId={params.tableId}
        />
        <div className="flex-1 overflow-hidden">
          <InterfacePage
            viewId={params.viewId}
            blocks={blocks}
            tabs={[]}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <ViewTopBar
        viewId={params.viewId}
        viewName={view.name}
        viewType={view.type as ViewType}
        tableId={params.tableId}
      />

      <div className="flex-1 overflow-hidden">
        {view.type === 'grid' && (
          <AirtableGridView
            tableName={table.supabase_table}
            viewName={view.name}
            rowHeight="medium"
            editable={true}
            fields={tableFields}
          />
        )}

        {view.type === 'calendar' && rowsData && (
          <CalendarView
            tableId={params.tableId}
            viewId={params.viewId}
            rows={rowsData.rows}
            visibleFields={rowsData.visibleFields}
          />
        )}

        {view.type === 'kanban' && rowsData && (
          <KanbanView
            tableId={params.tableId}
            viewId={params.viewId}
            rows={rowsData.rows}
            visibleFields={rowsData.visibleFields}
          />
        )}

        {view.type === 'form' && (
          <FormView
            tableId={params.tableId}
            viewId={params.viewId}
            visibleFields={viewFields}
          />
        )}
      </div>
    </div>
  )
}
