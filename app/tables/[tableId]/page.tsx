import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase'
import { loadViews } from '@/lib/views'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import ViewCard from '@/components/workspace/ViewCard'
import type { View } from '@/types/database'

export default async function TablePage({
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
  const { data: table } = await supabase
    .from('tables')
    .select('id, name, supabase_table, description')
    .eq('id', params.tableId)
    .single()

  if (!table) {
    return <div>Table not found</div>
  }

  // Load views
  const views = await loadViews(params.tableId)

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">{table.name}</h1>
        {table.description && (
          <p className="text-muted-foreground mt-2">{table.description}</p>
        )}
      </div>

      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Views</h2>
          <Button asChild>
            <Link href={`/tables/${params.tableId}/views/new`}>
              <Plus className="mr-2 h-4 w-4" />
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
            <div className="col-span-full text-center py-12">
              <p className="text-muted-foreground mb-4">No views yet</p>
              <Button asChild variant="outline">
                <Link href={`/tables/${params.tableId}/views/new`}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create First View
                </Link>
              </Button>
            </div>
          )}
          <Link href={`/tables/${params.tableId}/views/new`}>
            <div className="h-32 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center hover:border-gray-400 hover:bg-gray-50 transition-colors cursor-pointer">
              <div className="text-center">
                <Plus className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600">New View</p>
              </div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  )
}

