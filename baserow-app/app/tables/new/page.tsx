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

export default function NewTablePage() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const { data, error: insertError } = await supabase
        .from("tables")
        .insert([
          {
            name,
            description: description || null,
            access_control: "public",
          },
        ])
        .select()
        .single()

      if (insertError) {
        console.error("Insert error:", insertError)
        setError(insertError.message || "Failed to create table")
        setLoading(false)
      } else if (data && data.id) {
        console.log("Table created successfully:", data.id, data)
        // Verify the table exists by fetching it
        const { data: verifyData, error: verifyError } = await supabase
          .from("tables")
          .select("id, name")
          .eq("id", data.id)
          .single()
        
        if (verifyError || !verifyData) {
          console.error("Verification failed:", verifyError)
          setError(`Table created but verification failed: ${verifyError?.message || "Unknown error"}`)
          setLoading(false)
        } else {
          console.log("Table verified, redirecting to:", data.id)
          // Use replace instead of push to avoid back button issues
          router.replace(`/tables/${data.id}`)
        }
      } else {
        console.error("No data returned:", data)
        setError("Table was created but no ID was returned")
        setLoading(false)
      }
    } catch (err: any) {
      setError(err.message || "An error occurred")
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto p-6 max-w-2xl">
      <div className="mb-6">
        <Link
          href="/tables"
          className="text-sm text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Tables
        </Link>
        <h1 className="text-3xl font-bold mt-2">Create New Table</h1>
        <p className="text-muted-foreground mt-1">
          Create a new table to organize your data
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Table Details</CardTitle>
          <CardDescription>Enter the information for your new table</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Table Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Customers, Products, Orders"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description for this table"
              />
            </div>

            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="flex gap-2 pt-4">
              <Button type="submit" disabled={loading}>
                {loading ? "Creating..." : "Create Table"}
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link href="/tables">Cancel</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
