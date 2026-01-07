import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase'
import { checkViewAccess } from '@/lib/permissions'
import { loadView, loadViewFields } from '@/lib/views'
import { loadViewBlocks } from '@/lib/blocks'
import ViewTopBar from '@/components/views/ViewTopBar'
import ViewBlockWrapper from '../../data/[tableId]/views/[viewId]/ViewBlockWrapper'
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
  const blocks = await loadViewBlocks(params.viewId)

  // For interface pages (page type), use full-width layout with blocks
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

  // For form views, use FormView (not a data view, so doesn't use blocks)
  if (view.type === 'form') {
    return (
      <div className="flex flex-col h-screen bg-gray-50">
        <ViewTopBar
          viewId={params.viewId}
          viewName={view.name}
          viewType={view.type as ViewType}
          tableId={params.tableId}
        />
        <div className="flex-1 overflow-hidden">
          <FormView
            tableId={params.tableId}
            viewId={params.viewId}
            visibleFields={viewFields}
          />
        </div>
      </div>
    )
  }

  // For data page views (grid, kanban, calendar, timeline), use GridBlock
  // This ensures they share the same renderer, settings schema, and data logic as blocks
  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <ViewTopBar
        viewId={params.viewId}
        viewName={view.name}
        viewType={view.type as ViewType}
        tableId={params.tableId}
      />
      <div className="flex-1 overflow-hidden">
        <ViewBlockWrapper
          tableId={params.tableId}
          viewId={params.viewId}
          viewType={view.type as 'grid' | 'kanban' | 'calendar' | 'timeline'}
          viewConfig={view.config || {}}
        />
      </div>
    </div>
  )
}

