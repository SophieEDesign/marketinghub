"use client"

import type { PageBlock } from "@/lib/interface/types"
import { HardDrive } from "lucide-react"
import GalleryDriveView from "./gallery/GalleryDriveView"

interface DriveGalleryBlockProps {
  block: PageBlock
  isEditing?: boolean
}

export default function DriveGalleryBlock({ block, isEditing = false }: DriveGalleryBlockProps) {
  const { config } = block
  const rootFolderId = config?.drive_folder_id?.trim() || ""

  if (!rootFolderId) {
    return (
      <div className="flex h-full min-h-[200px] flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50/50 p-6 text-center">
        <HardDrive className="mb-2 h-8 w-8 text-gray-400" />
        <p className="text-sm font-medium text-gray-700">Google Drive gallery not configured</p>
        <p className="mt-1 max-w-sm text-xs text-gray-500">
          Add a Drive folder ID in block settings, or set <code className="text-[11px]">DRIVE_GALLERY_ROOT_FOLDER_ID</code> in the environment.
        </p>
      </div>
    )
  }

  return (
    <div className="h-full min-h-0 overflow-y-auto">
      <GalleryDriveView
        rootFolderId={rootFolderId}
        title={config?.title}
        subtitle={config?.subtitle}
        isEditing={isEditing}
      />
    </div>
  )
}
