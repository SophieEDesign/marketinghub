"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import type { PageBlock } from "@/lib/interface/types"
import { ExternalLink, Zap } from "lucide-react"

interface ButtonBlockProps {
  block: PageBlock
  isEditing?: boolean
}

function resolveButtonActionType(
  config: PageBlock["config"]
): "automation" | "link" | undefined {
  if (config?.button_action_type === "automation" || config?.button_action_type === "link") {
    return config.button_action_type
  }
  if (config?.button_automation_id) return "automation"
  if (config?.button_url?.trim()) return "link"
  return undefined
}

function openButtonLink(url: string, router: ReturnType<typeof useRouter>) {
  const trimmed = url.trim()
  if (!trimmed) return

  if (trimmed.startsWith("/") || trimmed.startsWith("?")) {
    router.push(trimmed)
    return
  }

  const href = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  window.open(href, "_blank", "noopener,noreferrer")
}

export default function ButtonBlock({ block, isEditing = false }: ButtonBlockProps) {
  const router = useRouter()
  const { config } = block
  const label = config?.button_label || "Button"
  const actionType = resolveButtonActionType(config)
  const automationId = config?.button_automation_id
  const linkUrl = config?.button_url?.trim()
  const isAutomation = actionType === "automation" && !!automationId
  const isLink = actionType === "link" && !!linkUrl
  const isConfigured = isAutomation || isLink
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    if (isEditing || !isConfigured) return

    if (isLink && linkUrl) {
      openButtonLink(linkUrl, router)
      return
    }

    if (!isAutomation || !automationId) return

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

  const appearance = config?.appearance || {}
  const buttonStyle: React.CSSProperties = {
    backgroundColor: appearance.button_background || "#2563eb",
    color: appearance.button_text_color || "#ffffff",
  }

  return (
    <div className="h-full flex flex-col items-center justify-center p-4">
      <button
        onClick={handleClick}
        disabled={!isConfigured || isEditing || loading}
        style={buttonStyle}
        className="px-6 py-3 rounded-md hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-opacity"
      >
        {isAutomation && <Zap className="h-4 w-4" />}
        {isLink && <ExternalLink className="h-4 w-4" />}
        {loading ? "Running..." : label}
      </button>
      {isEditing && !isConfigured && (
        <p className="text-xs text-gray-400 mt-2 text-center">
          Select an automation or add a link in settings
        </p>
      )}
    </div>
  )
}
