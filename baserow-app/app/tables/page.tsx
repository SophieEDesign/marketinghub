import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus } from "lucide-react"
import { getTables } from "@/lib/crud/tables"
import type { Table } from "@/types/database"

export default async function TablesPage() {
  // Authentication disabled for testing
  try {
    const tables = await getTables().catch(() => [])

    return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Tables</h1>
          <p className="text-muted-foreground mt-1">
            Manage your data tables and views
          </p>
        </div>
        <Button asChild>
          <Link href="/tables/new">
            <Plus className="mr-2 h-4 w-4" />
            New Table
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tables && tables.length > 0 ? (
          tables.map((table: Table) => (
            <Link key={table.id} href={`/tables/${table.id}`}>
              <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                <CardHeader>
                  <CardTitle>{table.name}</CardTitle>
                  {table.description && (
                    <CardDescription>{table.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground">
                    Access: {table.access_control}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))
        ) : (
          <div className="col-span-full text-center py-12">
            <p className="text-muted-foreground mb-4">No tables yet</p>
            <Button asChild>
              <Link href="/tables/new">
                <Plus className="mr-2 h-4 w-4" />
                Create your first table
              </Link>
            </Button>
          </div>
        )}
      </div>
    </div>
    )
  } catch (error) {
    console.error("Error loading tables:", error)
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-12">
          <p className="text-destructive">An error occurred while loading tables.</p>
        </div>
      </div>
    )
  }
}
