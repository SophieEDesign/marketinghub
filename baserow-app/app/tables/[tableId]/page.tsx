import Link from "next/link"
import { redirect } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, Grid, FileText, Columns, Calendar } from "lucide-react"
import { getTable } from "@/lib/crud/tables"
import { getViews } from "@/lib/crud/views"
import { createClient } from "@/lib/supabase/server"
import { isAdmin } from "@/lib/roles"
import WorkspaceShellWrapper from "@/components/layout/WorkspaceShellWrapper"
import type { View } from "@/types/database"

export default async function TablePage({
  params,
}: {
  params: { tableId: string }
}) {
  // Security: Only admins can access Core Data (tables)
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

    // Verify the Supabase table exists before proceeding
    if (table.supabase_table) {
      const supabase = await createClient()
      // Try a simple query to verify the table exists
      const { error: tableCheckError } = await supabase
        .from(table.supabase_table)
        .select('id')
        .limit(1)
      
      if (tableCheckError) {
        // Table doesn't exist or has schema issues
        const isTableNotFound = 
          tableCheckError.code === '42P01' || 
          tableCheckError.code === 'PGRST116' ||
          tableCheckError.message?.includes('does not exist') ||
          tableCheckError.message?.includes('relation')
        
        if (isTableNotFound) {
          return (
            <WorkspaceShellWrapper title={table.name}>
              <div className="text-center py-12">
                <p className="text-destructive mb-2">Supabase table not found</p>
                <p className="text-sm text-muted-foreground mb-4">
                  The table &quot;{table.supabase_table}&quot; does not exist in Supabase. 
                  This may happen if the table was deleted or never created.
                </p>
                <div className="flex gap-2 justify-center">
                  <Button asChild>
                    <Link href="/tables">Back to Tables</Link>
                  </Button>
                  <Button variant="outline" asChild>
                    <Link href={`/tables/${params.tableId}/views/new`}>Create View</Link>
                  </Button>
                </div>
              </div>
            </WorkspaceShellWrapper>
          )
        }
      }
    }

    let views = await getViews(params.tableId).catch(() => [])

    // If no views exist, create a default "All Records" grid view
    if (!views || views.length === 0) {
      try {
        const supabase = await createClient()
        const { data: newView, error: createError } = await supabase
          .from('views')
          .insert([
            {
              table_id: params.tableId,
              name: 'All Records',
              type: 'grid',
              config: {},
              access_level: 'authenticated',
            },
          ])
          .select()
          .single()

        if (!createError && newView) {
          views = [newView as View]
        }
      } catch (createError) {
        console.error('Error creating default view:', createError)
        // Continue to show view creation screen if creation fails
      }
    }

    // Find default grid view or first non-interface view
    // Note: Interface views don't have table_id, so they won't be in this list
    const defaultGridView = views.find((v: View) => v.type === 'grid') || views.find((v: View) => v.type !== 'interface')
    
    // If default grid view exists, redirect to it directly
    // Only redirect if we have a valid view ID to prevent redirect loops
    if (defaultGridView && defaultGridView.id) {
      // Verify the view actually exists before redirecting
      const supabase = await createClient()
      const { data: viewCheck } = await supabase
        .from('views')
        .select('id')
        .eq('id', defaultGridView.id)
        .maybeSingle()
      
      if (viewCheck) {
        redirect(`/tables/${params.tableId}/views/${defaultGridView.id}`)
      } else {
        console.warn(`View ${defaultGridView.id} not found, showing view selection screen`)
        // Fall through to show view selection screen
      }
    }

    // If no views exist, show view creation screen
    const viewIcons: Record<string, typeof Grid> = {
      grid: Grid,
      form: FileText,
      kanban: Columns,
      calendar: Calendar,
      gallery: Grid,
      page: FileText,
      interface: FileText, // Interface pages use FileText icon
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
  } catch (error: any) {
    // Don't catch redirect errors - let Next.js handle them
    // Next.js redirect() throws an error with digest property
    if (error?.digest?.startsWith('NEXT_REDIRECT') || error?.message?.includes('NEXT_REDIRECT')) {
      throw error // Re-throw redirect errors so Next.js can handle them
    }
    
    console.error("Error loading table:", error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    return (
      <WorkspaceShellWrapper title="Error">
        <div className="text-center py-12">
          <p className="text-destructive mb-2">An error occurred while loading this table.</p>
          <p className="text-sm text-muted-foreground mb-4">
            {errorMessage}
          </p>
          <Button asChild>
            <Link href="/tables">Back to Tables</Link>
          </Button>
        </div>
      </WorkspaceShellWrapper>
    )
  }
}
