"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import AutomationBuilder from "./AutomationBuilder"
import type { Automation, TableField } from "@/types/database"

interface EditAutomationClientProps {
  automationId: string
}

export default function EditAutomationClient({ automationId }: EditAutomationClientProps) {
  const router = useRouter()
  const [automation, setAutomation] = useState<Automation | null>(null)
  const [tableFields, setTableFields] = useState<TableField[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [automationId])

  async function loadData() {
    const supabase = createClient()

    // Load automation
    const { data: auto, error } = await supabase
      .from("automations")
      .select("*")
      .eq("id", automationId)
      .single()

    if (error || !auto) {
      console.error("Error loading automation:", error)
      setLoading(false)
      return
    }

    setAutomation(auto as Automation)

    // Load table fields only if table_id exists
    if (auto.table_id) {
      const { data: fields } = await supabase
        .from("table_fields")
        .select("*")
        .eq("table_id", auto.table_id)
        .order("position", { ascending: true })

      setTableFields((fields || []) as TableField[])
    } else {
      setTableFields([])
    }
    
    setLoading(false)
  }

  async function handleSave(updates: Partial<Automation>) {
    const supabase = createClient()

    // Keep legacy `trigger` JSONB in sync for backwards compatibility.
    // The DB schema still requires `trigger` and older migrations may read it.
    const triggerType = (updates.trigger_type || automation?.trigger_type || "row_created") as any
    const triggerConfig = {
      ...(automation?.trigger_config || {}),
      ...(updates.trigger_config || {}),
      table_id: automation?.table_id,
    }

    const { error } = await supabase
      .from("automations")
      .update({
        ...updates,
        trigger: { type: triggerType, config: triggerConfig },
        trigger_type: triggerType,
        trigger_config: triggerConfig,
        updated_at: new Date().toISOString(),
      })
      .eq("id", automationId)

    if (error) {
      throw new Error(error.message)
    }

    // Reload data
    await loadData()
  }

  async function handleTest() {
    // Test run - execute automation with sample data
    const response = await fetch(`/api/automations/${automationId}/test`, {
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
      .eq("id", automationId)

    if (error) {
      throw new Error(error.message)
    }

    router.push("/automations")
  }

  if (loading) {
    return <div>Loading automation...</div>
  }

  if (!automation) {
    return <div>Automation not found</div>
  }

  // Handle case where table_id might be undefined
  if (!automation.table_id) {
    return <div>Automation table ID is missing. Please update the automation to include a table ID.</div>
  }

  return (
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
  )
}
