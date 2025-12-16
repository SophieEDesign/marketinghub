"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

interface NewViewFormProps {
  tableId: string
}

export default function NewViewForm({ tableId }: NewViewFormProps) {
  const router = useRouter()
  const [name, setName] = useState("")
  const [type, setType] = useState<"grid" | "form" | "kanban" | "calendar" | "gallery" | "page">("grid")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // Get the highest order_index for this table's views
      const { data: existingViews } = await supabase
        .from("views")
        .select("order_index")
        .eq("table_id", tableId)
        .order("order_index", { ascending: false })
        .limit(1)

      const nextOrderIndex = existingViews && existingViews.length > 0 
        ? (existingViews[0].order_index || 0) + 1 
        : 0

      const { data, error: insertError } = await supabase
        .from("views")
        .insert([
          {
            table_id: tableId,
            name,
            type,
            order_index: nextOrderIndex,
          },
        ])
        .select()
        .single()

      if (insertError) {
        console.error("Insert error:", insertError)
        setError(insertError.message || "Failed to create view")
        setLoading(false)
      } else if (data && data.id) {
        console.log("View created successfully:", data.id, data)
        // Redirect to the new view page
        router.push(`/tables/${tableId}/views/${data.id}`)
        router.refresh()
      } else {
        console.error("No data returned:", data)
        setError("View was created but no ID was returned")
        setLoading(false)
      }
    } catch (err: any) {
      setError(err.message || "An error occurred")
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <Link
          href={`/tables/${tableId}`}
          className="text-sm text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Table
        </Link>
        <h1 className="text-2xl font-bold mt-2">Create New View</h1>
        <p className="text-muted-foreground mt-1">
          Create a new view for this table
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>View Details</CardTitle>
          <CardDescription>Enter the information for your new view</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">View Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., All Records, Active Items, My View"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">View Type *</Label>
              <select
                id="type"
                value={type}
                onChange={(e) => setType(e.target.value as typeof type)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                required
              >
                <option value="grid">Grid</option>
                <option value="form">Form</option>
                <option value="kanban">Kanban</option>
                <option value="calendar">Calendar</option>
                <option value="gallery">Gallery</option>
                <option value="page">Interface Page</option>
              </select>
            </div>

            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="flex gap-2 pt-4">
              <Button type="submit" disabled={loading}>
                {loading ? "Creating..." : "Create View"}
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link href={`/tables/${tableId}`}>Cancel</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
