import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { checkAccess } from "@/lib/access-control"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, Grid, FileText, Columns, Calendar } from "lucide-react"
import { getTable } from "@/lib/crud/tables"
import { getViews } from "@/lib/crud/views"
import type { View } from "@/types/database"

export default async function TablePage({
  params,
}: {
  params: { tableId: string }
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const table = await getTable(params.tableId)
  if (!table) {
    return <div>Table not found</div>
  }

  const hasAccess = await checkAccess(table.access_control, table.created_by)
  if (!hasAccess) {
    return <div>Access denied</div>
  }

  const views = await getViews(params.tableId)

  const viewIcons = {
    grid: Grid,
    form: FileText,
    kanban: Columns,
    calendar: Calendar,
    gallery: Grid,
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <Link href="/tables" className="text-sm text-muted-foreground hover:text-foreground mb-2 inline-block">
          ← Back to Tables
        </Link>
        <h1 className="text-3xl font-bold mt-2">{table.name}</h1>
        {table.description && (
          <p className="text-muted-foreground mt-1">{table.description}</p>
        )}
      </div>

      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-4">Views</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {views && views.length > 0 ? (
            views.map((view: View) => {
              const Icon = viewIcons[view.type] || Grid
              return (
                <Link key={view.id} href={`/tables/${params.tableId}/views/${view.id}`}>
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
          <Card className="hover:shadow-lg transition-shadow cursor-pointer border-dashed">
            <CardContent className="flex items-center justify-center p-6">
              <Button variant="ghost" asChild>
                <Link href={`/tables/${params.tableId}/views/new`}>
                  <Plus className="mr-2 h-4 w-4" />
                  New View
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
