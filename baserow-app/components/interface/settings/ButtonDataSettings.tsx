"use client"

import { useState, useEffect } from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { createClient } from "@/lib/supabase/client"
import type { BlockConfig } from "@/lib/interface/types"
import type { Automation } from "@/types/database"

interface ButtonDataSettingsProps {
  config: BlockConfig
  tables: any[]
  views: any[]
  fields: any[]
  onUpdate: (updates: Partial<BlockConfig>) => void
  onTableChange: (tableId: string) => Promise<void>
}

function resolveButtonActionType(config: BlockConfig): "automation" | "link" {
  if (config.button_action_type === "automation" || config.button_action_type === "link") {
    return config.button_action_type
  }
  if (config.button_automation_id) return "automation"
  if (config.button_url?.trim()) return "link"
  return "automation"
}

export default function ButtonDataSettings({
  config,
  onUpdate,
}: ButtonDataSettingsProps) {
  const [automations, setAutomations] = useState<Automation[]>([])
  const [loading, setLoading] = useState(true)
  const actionType = resolveButtonActionType(config)

  useEffect(() => {
    loadAutomations()
  }, [])

  async function loadAutomations() {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("automations")
        .select("*")
        .eq("enabled", true)
        .order("name", { ascending: true })

      if (error) {
        console.error("Error loading automations:", error)
      } else {
        setAutomations((data || []) as Automation[])
      }
    } catch (error) {
      console.error("Error loading automations:", error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Button Label */}
      <div className="space-y-2">
        <Label>Button Label *</Label>
        <Input
          value={config.button_label || ""}
          onChange={(e) => onUpdate({ button_label: e.target.value })}
          placeholder="Click Me"
        />
      </div>

      {/* Action Type */}
      <div className="space-y-2">
        <Label>When clicked</Label>
        <Select
          value={actionType}
          onValueChange={(value: "automation" | "link") =>
            onUpdate({ button_action_type: value })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="automation">Run automation</SelectItem>
            <SelectItem value="link">Open link</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {actionType === "automation" && (
        <div className="space-y-2">
          <Label>Automation</Label>
          <Select
            value={config.button_automation_id || "__none__"}
            onValueChange={(value) =>
              onUpdate({
                button_automation_id: value === "__none__" ? undefined : value,
              })
            }
            disabled={loading}
          >
            <SelectTrigger>
              <SelectValue placeholder={loading ? "Loading..." : "Select an automation"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">None</SelectItem>
              {automations.map((automation) => (
                <SelectItem key={automation.id} value={automation.id}>
                  {automation.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {config.button_automation_id && (
            <p className="text-xs text-gray-500 mt-1">
              This button will trigger the selected automation when clicked.
            </p>
          )}
        </div>
      )}

      {actionType === "link" && (
        <div className="space-y-2">
          <Label>Link URL *</Label>
          <Input
            value={config.button_url || ""}
            onChange={(e) => onUpdate({ button_url: e.target.value })}
            placeholder="https://example.com or /pages/my-page"
          />
          <p className="text-xs text-gray-500">
            Use a full URL for external sites (opens in a new tab) or a path like{" "}
            <code className="text-xs">/pages/my-page</code> for in-app navigation.
          </p>
        </div>
      )}
    </div>
  )
}
