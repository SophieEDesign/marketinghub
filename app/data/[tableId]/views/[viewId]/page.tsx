import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase'
import { checkViewAccess } from '@/lib/permissions'
import { isAdmin } from '@/lib/roles'
import { loadView, loadViewFields, loadViewTabs } from '@/lib/views'
import { loadViewBlocks } from '@/lib/blocks'
import ViewBlockWrapper from './ViewBlockWrapper'
import FormView from '@/components/views/FormView'
import InterfacePage from '@/components/views/InterfacePage'
import ViewPageClient from '@/components/views/ViewPageClient'

export default async function ViewPage({
  params,
}: {
  params: { tableId: string; viewId: string }
}) {
  // Security: Only admins can access Core Data (tables/views)
  const admin = await isAdmin()
  if (!admin) {
    // Redirect to first available interface page
    const supabase = await createServerSupabaseClient()
    const { data: firstPage } = await supabase
      .from('interface_pages')
      .select('id')
      .or('is_admin_only.is.null,is_admin_only.eq.false')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    
    if (firstPage) {
      redirect(`/pages/${firstPage.id}`)
    } else {
      redirect('/')
    }
  }

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

  // For interface pages (page type), use full-width layout with blocks
  if (view.type === 'page') {
    return (
      <ViewPageClient
        tableId={params.tableId}
        tableName={table.name}
        supabaseTableName={table.supabase_table}
        viewId={params.viewId}
        viewName={view.name}
        viewType={view.type}
      >
        <InterfacePage
          viewId={params.viewId}
          blocks={blocks}
          tabs={tabs}
        />
      </ViewPageClient>
    )
  }

  // For gallery views, use InterfacePage with blocks
  if (view.type === 'gallery') {
    return (
      <ViewPageClient
        tableId={params.tableId}
        tableName={table.name}
        supabaseTableName={table.supabase_table}
        viewId={params.viewId}
        viewName={view.name}
        viewType={view.type}
      >
        <InterfacePage
          viewId={params.viewId}
          blocks={blocks}
          tabs={tabs}
        />
      </ViewPageClient>
    )
  }

  // For form views, use FormView (not a data view, so doesn't use blocks)
  if (view.type === 'form') {
    return (
      <ViewPageClient
        tableId={params.tableId}
        tableName={table.name}
        supabaseTableName={table.supabase_table}
        viewId={params.viewId}
        viewName={view.name}
        viewType={view.type}
      >
        <FormView
          tableId={params.tableId}
          viewId={params.viewId}
          visibleFields={viewFields}
        />
      </ViewPageClient>
    )
  }

  // For data page views (grid, kanban, calendar, timeline), use GridBlock
  // This ensures they share the same renderer, settings schema, and data logic as blocks
  return (
    <ViewPageClient
      tableId={params.tableId}
      tableName={table.name}
      supabaseTableName={table.supabase_table}
      viewId={params.viewId}
      viewName={view.name}
      viewType={view.type}
    >
      <div className="h-full w-full">
        <ViewBlockWrapper
          tableId={params.tableId}
          viewId={params.viewId}
          viewType={view.type as 'grid' | 'kanban' | 'calendar' | 'timeline'}
          viewConfig={view.config || {}}
        />
      </div>
    </ViewPageClient>
  )
}
