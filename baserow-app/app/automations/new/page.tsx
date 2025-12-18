"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import WorkspaceShellWrapper from "@/components/layout/WorkspaceShellWrapper"
import AutomationBuilder from "@/components/automations/AutomationBuilder"
import type { Automation, TableField } from "@/types/database"

export default function NewAutomationPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [tableFields, setTableFields] = useState<TableField[]>([])
  const [loading, setLoading] = useState(true)

  const tableId = searchParams.get("tableId")

  useEffect(() => {
    if (tableId) {
      loadFields()
    } else {
      setLoading(false)
    }
  }, [tableId])

  async function loadFields() {
    if (!tableId) return

    const supabase = createClient()

    const { data: fields } = await supabase
      .from("table_fields")
      .select("*")
      .eq("table_id", tableId)
      .order("position", { ascending: true })

    setTableFields((fields || []) as TableField[])
    setLoading(false)
  }

  async function handleSave(automation: Partial<Automation>) {
    if (!tableId) {
      throw new Error("Table ID is required")
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

  if (loading) {
    return (
      <WorkspaceShellWrapper title="New Automation">
        <div>Loading...</div>
      </WorkspaceShellWrapper>
    )
  }

  if (!tableId) {
    return (
      <WorkspaceShellWrapper title="New Automation">
        <div>Table ID is required. Please provide ?tableId=...</div>
      </WorkspaceShellWrapper>
    )
  }

  return (
    <WorkspaceShellWrapper title="New Automation">
      <div className="max-w-4xl mx-auto">
        <AutomationBuilder
          tableId={tableId}
          tableFields={tableFields}
          onSave={handleSave}
        />
      </div>
    </WorkspaceShellWrapper>
  )
}
