"use client"

import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import type { BlockConfig } from "@/lib/interface/types"

interface DriveGalleryDataSettingsProps {
  config: BlockConfig
  onUpdate: (updates: Partial<BlockConfig>) => void
}

export default function DriveGalleryDataSettings({
  config,
  onUpdate,
}: DriveGalleryDataSettingsProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="drive-gallery-title">Title</Label>
        <Input
          id="drive-gallery-title"
          value={config.title || ""}
          onChange={(e) => onUpdate({ title: e.target.value })}
          placeholder="Shared Image Gallery"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="drive-gallery-subtitle">Subtitle</Label>
        <Textarea
          id="drive-gallery-subtitle"
          value={config.subtitle || ""}
          onChange={(e) => onUpdate({ subtitle: e.target.value })}
          placeholder="Approved marine photography by vessel type and sector."
          rows={3}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="drive-gallery-folder-id">Google Drive folder ID</Label>
        <Input
          id="drive-gallery-folder-id"
          value={config.drive_folder_id || ""}
          onChange={(e) => onUpdate({ drive_folder_id: e.target.value })}
          placeholder="1-pHl-DXNlOPC4LuWneYmHB-fzHscofyS"
          className="font-mono text-sm"
        />
        <p className="text-xs text-gray-500">
          Root folder shared with the service account. Falls back to <code>DRIVE_GALLERY_ROOT_FOLDER_ID</code> on the server when empty.
        </p>
      </div>
    </div>
  )
}
