"use client"

import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { BlockConfig } from "@/lib/interface/types"

interface HtmlDataSettingsProps {
  config: BlockConfig
  onUpdate: (updates: Partial<BlockConfig>) => void
}

export default function HtmlDataSettings({
  config,
  onUpdate,
}: HtmlDataSettingsProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>HTML Content</Label>
        <Textarea
          value={config.html || ""}
          onChange={(e) => onUpdate({ html: e.target.value })}
          placeholder="<div>Your custom HTML here...</div>"
          className="font-mono text-sm min-h-[200px]"
          rows={10}
        />
        <p className="text-xs text-gray-500">
          Paste custom HTML snippets, embeds, or widgets. Only trusted users should edit this block.
        </p>
      </div>
    </div>
  )
}
