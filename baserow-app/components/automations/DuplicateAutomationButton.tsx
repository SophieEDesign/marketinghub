"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Copy, Check } from "lucide-react"
import type { Automation } from "@/types/database"

interface DuplicateAutomationButtonProps {
  automation: Automation
}

export default function DuplicateAutomationButton({ automation }: DuplicateAutomationButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  async function handleDuplicate() {
    if (loading) return

    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    try {
      // Create a copy of the automation
      const { data: newAutomation, error } = await supabase
        .from("automations")
        .insert([
          {
            name: `${automation.name} - Copy`,
            description: automation.description || '',
            trigger_type: automation.trigger_type,
            trigger_config: automation.trigger_config || {},
            trigger: automation.trigger || {},
            actions: automation.actions || [],
            conditions: automation.conditions || [],
            enabled: false, // Disable by default for safety
            table_id: automation.table_id,
            created_by: user?.id,
          },
        ])
        .select()
        .single()

      if (error) {
        throw new Error(error.message)
      }

      setCopied(true)
      setTimeout(() => {
        router.push(`/automations/${newAutomation.id}`)
      }, 500)
    } catch (error: any) {
      console.error("Error duplicating automation:", error)
      alert(`Failed to duplicate automation: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleDuplicate}
      disabled={loading || copied}
      className="p-2 text-gray-600 hover:bg-gray-100 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      title="Duplicate automation"
    >
      {copied ? (
        <Check className="h-4 w-4 text-green-600" />
      ) : (
        <Copy className="h-4 w-4" />
      )}
    </button>
  )
}
