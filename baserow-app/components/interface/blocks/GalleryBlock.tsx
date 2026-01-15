"use client"

import type { PageBlock } from "@/lib/interface/types"
import GridBlock from "./GridBlock"
import type { FilterConfig } from "@/lib/interface/filters"

interface GalleryBlockProps {
  block: PageBlock
  isEditing?: boolean
  pageTableId?: string | null
  pageId?: string | null
  filters?: FilterConfig[]
  onRecordClick?: (recordId: string) => void
}

/**
 * GalleryBlock - Wrapper around GridBlock with view_type='gallery'
 * Displays data in a card-based gallery layout.
 */
export default function GalleryBlock({
  block,
  isEditing = false,
  pageTableId = null,
  pageId = null,
  filters = [],
  onRecordClick,
}: GalleryBlockProps) {
  const galleryBlock: PageBlock = {
    ...block,
    config: {
      ...block.config,
      view_type: "gallery",
    },
  }

  return (
    <GridBlock
      block={galleryBlock}
      isEditing={isEditing}
      pageTableId={pageTableId}
      pageId={pageId}
      filters={filters}
      onRecordClick={onRecordClick}
    />
  )
}

