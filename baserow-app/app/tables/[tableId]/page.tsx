import Link from "next/link"
import { redirect } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, Grid, FileText, Columns, Calendar } from "lucide-react"
import { getTable } from "@/lib/crud/tables"
import { getViews } from "@/lib/crud/views"
import WorkspaceShellWrapper from "@/components/layout/WorkspaceShellWrapper"
import type { View } from "@/types/database"

export default async function TablePage({
  params,
}: {
  params: { tableId: string }
}) {
  // Authentication disabled for testing
  try {
    console.log("Fetching table with ID:", params.tableId)
    const table = await getTable(params.tableId)
    console.log("Table result:", table ? `Found: ${table.name}` : "Not found")
    
    if (!table) {
      return (
        <WorkspaceShellWrapper title="Table not found">
          <div className="text-center py-12">
            <p className="text-destructive mb-4">Table not found (ID: {params.tableId})</p>
            <p className="text-sm text-muted-foreground mb-4">
              The table may not exist or you may not have permission to view it.
            </p>
            <Button asChild>
              <Link href="/tables">Back to Tables</Link>
            </Button>
          </div>
        </WorkspaceShellWrapper>
      )
    }

    const views = await getViews(params.tableId).catch(() => [])

    // Find default grid view or first non-interface view
    // Note: Interface views don't have table_id, so they won't be in this list
    const defaultGridView = views.find((v: View) => v.type === 'grid') || views.find((v: View) => v.type !== 'interface')
    
    // If default grid view exists, redirect to it directly
    if (defaultGridView) {
      redirect(`/tables/${params.tableId}/views/${defaultGridView.id}`)
    }

    // If no views exist, show view creation screen
    const viewIcons = {
      grid: Grid,
      form: FileText,
      kanban: Columns,
      calendar: Calendar,
      gallery: Grid,
      page: FileText,
    }

    return (
      <WorkspaceShellWrapper title={table.name}>
        <div>
          <div className="mb-6">
            <h1 className="text-2xl font-bold">{table.name}</h1>
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
      </WorkspaceShellWrapper>
    )
  } catch (error) {
    console.error("Error loading table:", error)
    return (
      <WorkspaceShellWrapper title="Error">
        <div className="text-center py-12">
          <p className="text-destructive">An error occurred while loading this table.</p>
        </div>
      </WorkspaceShellWrapper>
    )
  }
}
