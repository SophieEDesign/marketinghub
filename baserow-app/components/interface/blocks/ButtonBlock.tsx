"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { PageBlock } from "@/lib/interface/types"
import { Zap } from "lucide-react"

interface ButtonBlockProps {
  block: PageBlock
  isEditing?: boolean
}

export default function ButtonBlock({ block, isEditing = false }: ButtonBlockProps) {
  const { config } = block
  const label = config?.button_label || "Button"
  const automationId = config?.button_automation_id
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    if (!automationId || isEditing) return

    setLoading(true)
    try {
      const response = await fetch(`/api/automations/${automationId}/test`, {
        method: "POST",
      })

      const result = await response.json()

      if (result.success) {
        alert("Automation triggered successfully!")
      } else {
        alert(`Error: ${result.error || "Failed to trigger automation"}`)
      }
    } catch (error) {
      console.error("Error triggering automation:", error)
      alert("Failed to trigger automation")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="h-full flex items-center justify-center p-4">
      <button
        onClick={handleClick}
        disabled={!automationId || isEditing || loading}
        className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
      >
        {automationId && <Zap className="h-4 w-4" />}
        {loading ? "Running..." : label}
      </button>
      {isEditing && !automationId && (
        <p className="text-xs text-gray-400 mt-2">Select an automation in settings</p>
      )}
    </div>
  )
}
