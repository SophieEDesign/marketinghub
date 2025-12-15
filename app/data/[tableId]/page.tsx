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
              <Plus className="mr-2 h-4 w-4" />
              New View
            </Link>
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {views && views.length > 0 ? (
            views.map((view: View) => {
              const Icon = viewIcons[view.type] || Grid
              return (
                <Link key={view.id} href={`/data/${params.tableId}/views/${view.id}`}>
                  <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                    <CardHeader>
                      <div className="flex items-center gap-2">
                        <Icon className="h-5 w-5" />
                        <CardTitle>{view.name}</CardTitle>
                      </div>
                      <CardDescription>Type: {view.type}</CardDescription>
                    </CardHeader>
                  </Card>
                </Link>
              )
            })
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
