"use client"

import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
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
      {/* Info Message */}
      <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
        <p className="text-sm text-blue-800">
          <strong>Tip:</strong> Text content is edited directly in the block. Click on the text block to edit inline.
        </p>
      </div>

      {/* Content Preview (Read-only) */}
      <div className="space-y-2">
        <Label>Content Preview</Label>
        <div className="p-3 bg-gray-50 border border-gray-200 rounded-md text-sm text-gray-600 min-h-[100px] max-h-[200px] overflow-auto">
          {config.content || config.text_content || (
            <span className="text-gray-400 italic">No content yet. Click on the text block to add content.</span>
          )}
        </div>
        <p className="text-xs text-gray-500">
          Supports markdown formatting. Edit content directly in the block.
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

