"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import AutomationBuilder from "./AutomationBuilder"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { Automation, TableField } from "@/types/database"

export default function NewAutomationClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [tableFields, setTableFields] = useState<TableField[]>([])
  const [tables, setTables] = useState<Array<{ id: string; name: string }>>([])
  const [loading, setLoading] = useState(true)
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null)

  // Get tableId from URL or use selected table
  const urlTableId = searchParams.get("tableId")
  const tableId = urlTableId || selectedTableId

  useEffect(() => {
    loadTables()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (tableId) {
      loadFields()
    } else {
      setTableFields([])
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableId])

  async function loadTables() {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("tables")
        .select("id, name")
        .order("name", { ascending: true })

      if (!error && data) {
        setTables(data)
        // If tableId is in URL, use it; otherwise select first table if available
        if (urlTableId) {
          setSelectedTableId(urlTableId)
        } else if (data.length > 0) {
          setSelectedTableId(data[0].id)
        }
      }
      setLoading(false)
    } catch (error) {
      console.error("Error loading tables:", error)
      setLoading(false)
    }
  }

  async function loadFields() {
    if (!tableId) return

    setLoading(true)
    try {
      const supabase = createClient()

      // Try to load from table_fields table, but handle gracefully if it doesn't exist
      const { data: fields, error } = await supabase
        .from("table_fields")
        .select("*")
        .eq("table_id", tableId)
        .order("position", { ascending: true })

      if (error) {
        // If table_fields doesn't exist, that's okay - automation can still be created
        console.warn("Could not load table fields:", error)
        setTableFields([])
      } else {
        setTableFields((fields || []) as TableField[])
      }
    } catch (error) {
      console.error("Error loading fields:", error)
      setTableFields([])
    } finally {
      setLoading(false)
    }
  }

  async function handleSave(automation: Partial<Automation>) {
    if (!tableId) {
      throw new Error("Please select a table first")
    }

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const { data, error } = await supabase
      .from("automations")
      .insert([
        {
          table_id: tableId,
          name: automation.name,
          description: automation.description,
          trigger_type: automation.trigger_type,
          trigger_config: automation.trigger_config || {},
          actions: automation.actions || [],
          conditions: automation.conditions || [],
          enabled: automation.enabled ?? true,
          created_by: user?.id,
        },
      ])
      .select()
      .single()

    if (error) {
      throw new Error(error.message)
    }

    router.push(`/automations/${data.id}`)
  }

  if (loading && tables.length === 0) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center text-muted-foreground">Loading...</div>
      </div>
    )
  }

  // Show table selector if no table is selected
  if (!tableId) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Select a Table</CardTitle>
            <CardDescription>
              Choose a table to create an automation for
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="table-select">Table</Label>
                <Select
                  value={selectedTableId || ""}
                  onValueChange={(value) => setSelectedTableId(value)}
                >
                  <SelectTrigger id="table-select">
                    <SelectValue placeholder="Select a table" />
                  </SelectTrigger>
                  <SelectContent>
                    {tables.map((table) => (
                      <SelectItem key={table.id} value={table.id}>
                        {table.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {tables.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No tables found. Create a table first to create automations.
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {!urlTableId && (
        <div className="mb-6">
          <Label htmlFor="table-select" className="mb-2 block">Table</Label>
          <Select
            value={tableId}
            onValueChange={(value) => setSelectedTableId(value)}
          >
            <SelectTrigger id="table-select" className="w-full max-w-md">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {tables.map((table) => (
                <SelectItem key={table.id} value={table.id}>
                  {table.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <AutomationBuilder
        tableId={tableId}
        tableFields={tableFields}
        onSave={handleSave}
      />
    </div>
  )
}
