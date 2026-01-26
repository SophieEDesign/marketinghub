"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import AutomationBuilder from "./AutomationBuilder"
import AutomationTemplates from "./AutomationTemplates"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { Automation, TableField } from "@/types/database"
import type { AutomationTemplate } from "@/lib/automations/templates"
import { Sparkles } from "lucide-react"

export default function NewAutomationClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [tableFields, setTableFields] = useState<TableField[]>([])
  const [tables, setTables] = useState<Array<{ id: string; name: string }>>([])
  const [loading, setLoading] = useState(true)
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null)
  const [showTemplates, setShowTemplates] = useState(false)
  const [templateAutomation, setTemplateAutomation] = useState<Partial<Automation> | null>(null)

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

    // Backwards-compatible trigger payload:
    // DB schema still requires `trigger` (jsonb NOT NULL), while app uses `trigger_type`/`trigger_config`.
    const triggerType = (automation.trigger_type || "row_created") as any
    const triggerConfig = { ...(automation.trigger_config || {}), table_id: tableId }

    const { data, error } = await supabase
      .from("automations")
      .insert([
        {
          table_id: tableId,
          name: automation.name,
          description: automation.description,
          trigger: { type: triggerType, config: triggerConfig },
          trigger_type: triggerType,
          trigger_config: triggerConfig,
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

  function handleTemplateSelect(template: AutomationTemplate) {
    setTemplateAutomation({
      name: template.name,
      description: template.description,
      trigger_type: template.triggerType,
      trigger_config: template.triggerConfig,
      actions: template.actions,
      conditions: template.conditions,
    })
    setShowTemplates(false)
  }

  // Show table selector if no table is selected
  if (!tableId && !templateAutomation) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        {showTemplates && (
          <AutomationTemplates
            onSelectTemplate={handleTemplateSelect}
            onClose={() => setShowTemplates(false)}
          />
        )}
        <Card>
          <CardHeader>
            <CardTitle>Create New Automation</CardTitle>
            <CardDescription>
              Start with a template or create from scratch
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Card className="border-2 border-dashed hover:border-blue-500 transition-colors cursor-pointer" onClick={() => setShowTemplates(true)}>
                <CardContent className="p-6 text-center">
                  <Sparkles className="h-12 w-12 mx-auto mb-4 text-blue-600" />
                  <h3 className="text-lg font-semibold mb-2">Start with a Template</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Choose from pre-built automation templates
                  </p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setShowTemplates(true)
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  >
                    Browse Templates
                  </button>
                </CardContent>
              </Card>
              <div className="text-center text-sm text-gray-500">or</div>
              <div className="space-y-2">
                <Label htmlFor="table-select">Select a Table</Label>
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
      {showTemplates && (
        <AutomationTemplates
          onSelectTemplate={handleTemplateSelect}
          onClose={() => setShowTemplates(false)}
        />
      )}

      {!templateAutomation && !tableId && (
        <div className="mb-6">
          <Card className="p-6 border-2 border-dashed border-gray-300 hover:border-blue-500 transition-colors">
            <div className="text-center">
              <Sparkles className="h-12 w-12 mx-auto mb-4 text-blue-600" />
              <h3 className="text-lg font-semibold mb-2">Start with a Template</h3>
              <p className="text-sm text-gray-600 mb-4">
                Choose from pre-built automation templates to get started quickly
              </p>
              <button
                onClick={() => setShowTemplates(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Browse Templates
              </button>
              <div className="mt-4 text-sm text-gray-500">
                or
              </div>
            </div>
          </Card>
        </div>
      )}

      {!urlTableId && !templateAutomation && (
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
      {(tableId || templateAutomation) && (
        <AutomationBuilder
          automation={templateAutomation as Automation}
          tableId={(tableId || urlTableId || '') as string}
          tableFields={tableFields}
          onSave={handleSave}
        />
      )}
    </div>
  )
}
