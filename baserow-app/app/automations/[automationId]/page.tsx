"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import WorkspaceShellWrapper from "@/components/layout/WorkspaceShellWrapper"
import AutomationBuilder from "@/components/automations/AutomationBuilder"
import type { Automation, TableField } from "@/types/database"

export default function AutomationPage({
  params,
}: {
  params: { automationId: string }
}) {
  const router = useRouter()
  const [automation, setAutomation] = useState<Automation | null>(null)
  const [tableFields, setTableFields] = useState<TableField[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [params.automationId])

  async function loadData() {
    const supabase = createClient()

    // Load automation
    const { data: auto, error } = await supabase
      .from("automations")
      .select("*")
      .eq("id", params.automationId)
      .single()

    if (error || !auto) {
      console.error("Error loading automation:", error)
      setLoading(false)
      return
    }

    setAutomation(auto as Automation)

    // Load table fields
    const { data: fields } = await supabase
      .from("table_fields")
      .select("*")
      .eq("table_id", auto.table_id)
      .order("position", { ascending: true })

    setTableFields((fields || []) as TableField[])
    setLoading(false)
  }

  async function handleSave(updates: Partial<Automation>) {
    const supabase = createClient()

    const { error } = await supabase
      .from("automations")
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.automationId)

    if (error) {
      throw new Error(error.message)
    }

    // Reload data
    await loadData()
  }

  async function handleTest() {
    // Test run - execute automation with sample data
    const response = await fetch(`/api/automations/${params.automationId}/test`, {
      method: 'POST',
    })

    const result = await response.json()
    
    if (!result.success) {
      throw new Error(result.error || 'Test run failed')
    }

    alert('Test run completed! Check automation logs for details.')
  }

  async function handleDelete() {
    if (!confirm("Are you sure you want to delete this automation?")) {
      return
    }

    const supabase = createClient()

    const { error } = await supabase
      .from("automations")
      .delete()
      .eq("id", params.automationId)

    if (error) {
      throw new Error(error.message)
    }

    router.push("/automations")
  }

  if (loading) {
    return (
      <WorkspaceShellWrapper title="Loading...">
        <div>Loading automation...</div>
      </WorkspaceShellWrapper>
    )
  }

  if (!automation) {
    return (
      <WorkspaceShellWrapper title="Automation not found">
        <div>Automation not found</div>
      </WorkspaceShellWrapper>
    )
  }

  return (
    <WorkspaceShellWrapper title={automation.name || "Edit Automation"}>
      <div className="max-w-4xl mx-auto">
        <AutomationBuilder
          automation={automation}
          tableId={automation.table_id}
          tableFields={tableFields}
          onSave={handleSave}
          onTest={handleTest}
          onDelete={handleDelete}
        />
      </div>
    </WorkspaceShellWrapper>
  )
}
