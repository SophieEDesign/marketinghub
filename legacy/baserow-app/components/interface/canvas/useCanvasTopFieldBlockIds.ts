"use client"

import { useMemo } from "react"
import type { PageBlock } from "@/lib/interface/types"

/**
 * Top two field blocks (by y) for inline editing without Edit button.
 * On record view pages, only blocks in the right column (x >= 4) qualify.
 */
export function useCanvasTopFieldBlockIds(
  blocks: PageBlock[],
  mode: "view" | "edit" | "review",
  recordId: string | null
): Set<string> {
  return useMemo(() => {
    const fieldBlocks = blocks
      .filter((block) => {
        if (block.type !== "field") return false
        const blockX = block.x ?? 0
        if (mode === "view" && recordId) {
          return blockX >= 4
        }
        return true
      })
      .sort((a, b) => {
        const aY = a.y ?? 0
        const bY = b.y ?? 0
        if (aY !== bY) return aY - bY
        return (a.x ?? 0) - (b.x ?? 0)
      })
      .slice(0, 2)
      .map((block) => block.id)

    return new Set(fieldBlocks)
  }, [blocks, mode, recordId])
}
