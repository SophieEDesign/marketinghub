"use client"

import type { PageBlock } from "@/lib/interface/types"
import GridBlock from "./GridBlock"
import type { FilterConfig } from "@/lib/interface/filters"
import type { FilterTree } from "@/lib/filters/canonical-model"
import type { FieldLayoutItem } from "@/lib/interface/field-layout-utils"

interface GalleryBlockProps {
  block: PageBlock
  isEditing?: boolean
  interfaceMode?: 'view' | 'edit'
  pageTableId?: string | null
  pageId?: string | null
  filters?: FilterConfig[]
  filterTree?: FilterTree
  onRecordClick?: (recordId: string) => void
  pageShowAddRecord?: boolean
  onModalLayoutSave?: (fieldLayout: FieldLayoutItem[]) => void
  canEditLayout?: boolean
}

/**
 * GalleryBlock - Wrapper around GridBlock with view_type='gallery'
 * Displays data in a card-based gallery layout.
 */
export default function GalleryBlock({
  block,
  isEditing = false,
  interfaceMode = 'view',
  pageTableId = null,
  pageId = null,
  filters = [],
  filterTree = null,
  onRecordClick,
  pageShowAddRecord = false,
  onModalLayoutSave,
  canEditLayout = false,
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
      interfaceMode={interfaceMode}
      pageTableId={pageTableId}
      pageId={pageId}
      filters={filters}
      filterTree={filterTree}
      onRecordClick={onRecordClick}
      pageShowAddRecord={pageShowAddRecord}
      onModalLayoutSave={onModalLayoutSave}
      canEditLayout={canEditLayout}
    />
  )
}

