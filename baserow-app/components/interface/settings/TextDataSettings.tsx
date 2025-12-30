"use client"

import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import type { BlockConfig } from "@/lib/interface/types"
import type { BlockConfig } from "@/lib/interface/types"

interface TextDataSettingsProps {
  config: BlockConfig
  tables: any[]
  views: any[]
  fields: any[]
  onUpdate: (updates: Partial<BlockConfig>) => void
  onTableChange: (tableId: string) => Promise<void>
}

export default function TextDataSettings({
  config,
  onUpdate,
}: TextDataSettingsProps) {
  return (
    <div className="space-y-4">
      {/* Content */}
      <div className="space-y-2">
        <Label>Content *</Label>
        <Textarea
          value={config.content || config.text_content || ""}
          onChange={(e) => onUpdate({ content: e.target.value, text_content: e.target.value })}
          placeholder="Enter text or markdown content..."
          rows={10}
          className="font-mono text-sm"
        />
        <p className="text-xs text-gray-500">
          Supports markdown formatting
        </p>
      </div>

      {/* Markdown Toggle */}
      <div className="flex items-center justify-between">
        <div>
          <Label>Enable Markdown</Label>
          <p className="text-xs text-gray-500 mt-1">
            Render markdown formatting
          </p>
        </div>
        <Switch
          checked={config.markdown !== false}
          onCheckedChange={(checked) => onUpdate({ markdown: checked })}
        />
      </div>
    </div>
  )
}

