import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase'
import { checkTableAccess } from '@/lib/permissions'
import { loadViews } from '@/lib/views'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Grid, FileText, Columns, Calendar, Layout } from 'lucide-react'
import type { View } from '@/types/database'

export default async function TableDataPage({
  params,
}: {
  params: { tableId: string }
}) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Load table
  const { data: table, error: tableError } = await supabase
    .from('tables')
    .select('id, name, supabase_table')
    .eq('id', params.tableId)
    .single()

  if (tableError || !table) {
    return <div>Table not found</div>
  }

  // Load views
  const views = await loadViews(params.tableId)

  const viewIcons = {
    grid: Grid,
    form: FileText,
    kanban: Columns,
    calendar: Calendar,
    gallery: Layout,
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">{table.name}</h1>
      </div>

      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Views</h2>
          <Button asChild>
            <Link href={`/data/${params.tableId}/views/new`}>
            <Link href={`/tables/${params.tableId}/views/new`}>
              New View
            </Link>
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {views && views.length > 0 ? (
            views.map((view: View) => (
              <ViewCard
                key={view.id}
                view={view}
                tableId={params.tableId}
                href={`/tables/${params.tableId}/views/${view.id}`}
              />
            ))
          ) : (
            <div className="col-span-full text-center py-8">
              <p className="text-muted-foreground mb-4">No views yet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
