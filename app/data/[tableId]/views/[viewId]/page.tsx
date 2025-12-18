import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase'
import { checkViewAccess } from '@/lib/permissions'
import { loadView, loadViewFields, loadViewTabs } from '@/lib/views'
import { loadViewBlocks } from '@/lib/blocks'
import { loadRows } from '@/lib/data'
import GridView from '@/components/views/GridView'
import KanbanView from '@/components/views/KanbanView'
import CalendarView from '@/components/calendar/CalendarView'
import FormView from '@/components/views/FormView'
import InterfacePage from '@/components/views/InterfacePage'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Settings } from 'lucide-react'

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
  const blocks = await loadViewBlocks(params.viewId)
  const tabs = view.type === 'page' ? await loadViewTabs(params.viewId) : []

  // Load data for non-page views
  let rowsData = null
  if (view.type !== 'gallery' && view.type !== 'page') {
    rowsData = await loadRows({
      tableId: params.tableId,
      viewId: params.viewId,
    })
  }

  // For interface pages, use full-width layout
  if (view.type === 'page') {
    return (
      <div className="w-full h-full">
        <InterfacePage
          viewId={params.viewId}
          blocks={blocks}
          tabs={tabs}
        />
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link
            href={`/data/${params.tableId}`}
            className="text-sm text-muted-foreground hover:text-foreground mb-2 inline-block"
          >
            ← Back to {table.name}
          </Link>
          <h1 className="text-3xl font-bold mt-2">{view.name}</h1>
          <p className="text-muted-foreground mt-1">
            {table.name} • {view.type} view
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href={`/data/${params.tableId}/views/${params.viewId}/edit`}>
            <Settings className="mr-2 h-4 w-4" />
            Edit View
          </Link>
        </Button>
      </div>

      <div className="space-y-6">
        {view.type === 'grid' && rowsData && (
          <GridView
            tableId={params.tableId}
            viewId={params.viewId}
            rows={rowsData.rows}
            visibleFields={rowsData.visibleFields}
            filters={rowsData.filters}
            sorts={rowsData.sorts}
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

        {view.type === 'calendar' && rowsData && (
          <CalendarView
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

        {view.type === 'gallery' && (
          <InterfacePage
            viewId={params.viewId}
            blocks={blocks}
            tabs={tabs}
          />
        )}
      </div>
    </div>
  )
}
