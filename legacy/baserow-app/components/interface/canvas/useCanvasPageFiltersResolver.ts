"use client"

import { useCallback } from "react"
import type { PageBlock } from "@/lib/interface/types"
import type { FilterConfigWithSource } from "@/lib/interface/filter-state"

/**
 * Stabilizes the per-block filter resolver passed to usePageAggregates.
 * A new inline callback each render caused React #185 (maximum update depth).
 */
export function useCanvasPageFiltersResolver(
  blocks: PageBlock[],
  pageTableId: string | null | undefined,
  getFiltersForBlock: (blockId: string, blockTableId?: string | null) => FilterConfigWithSource[]
) {
  return useCallback(
    (blockId: string) => {
      const block = blocks.find((b) => b.id === blockId)
      const blockTableId = block?.config?.table_id || pageTableId
      return getFiltersForBlock(blockId, blockTableId)
    },
    [blocks, pageTableId, getFiltersForBlock]
  )
}
