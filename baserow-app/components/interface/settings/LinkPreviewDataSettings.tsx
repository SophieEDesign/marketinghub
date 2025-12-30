"use client"

import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import type { BlockConfig } from "@/lib/interface/types"

interface LinkPreviewDataSettingsProps {
  config: BlockConfig
  tables: any[]
  views: any[]
  fields: any[]
  onUpdate: (updates: Partial<BlockConfig>) => void
  onTableChange: (tableId: string) => Promise<void>
}

export default function LinkPreviewDataSettings({
  config,
  onUpdate,
}: LinkPreviewDataSettingsProps) {
  return (
    <div className="space-y-4">
      {/* URL */}
      <div className="space-y-2">
        <Label>External URL *</Label>
        <Input
          type="url"
          value={config.url || config.link_url || ""}
          onChange={(e) => onUpdate({ url: e.target.value, link_url: e.target.value })}
          placeholder="https://onedrive.live.com/..."
        />
        <p className="text-xs text-gray-500">
          Supports OneDrive, SharePoint, Google Drive, Dropbox links
        </p>
      </div>

      {/* Display Name Override */}
      <div className="space-y-2">
        <Label>Display Name (optional)</Label>
        <Input
          value={config.link_title || config.title || ""}
          onChange={(e) => onUpdate({ link_title: e.target.value, title: e.target.value })}
          placeholder="Override file name"
        />
        <p className="text-xs text-gray-500">
          Leave empty to use detected file name
        </p>
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label>Description (optional)</Label>
        <Input
          value={config.link_description || config.description || ""}
          onChange={(e) => onUpdate({ link_description: e.target.value, description: e.target.value })}
          placeholder="File description"
        />
      </div>
    </div>
  )
}

