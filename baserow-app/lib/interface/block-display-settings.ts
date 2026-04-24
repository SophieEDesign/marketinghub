import type { BlockConfig, BlockType } from "@/lib/interface/types"

export type BlockDisplayMode = "fit" | "fixed"
export type BlockOverflowBehaviour = "view_all" | "scroll" | "paginate"

export interface ResolvedBlockDisplaySettings {
  displayMode: BlockDisplayMode
  recordLimit: number
  overflowBehaviour: BlockOverflowBehaviour
}

const DATA_BLOCK_TYPES = new Set<BlockType>([
  "grid",
  "list",
  "gallery",
  "calendar",
  "timeline",
  "kanban",
])

const DEFAULT_RECORD_LIMIT_BY_TYPE: Partial<Record<BlockType, number>> = {
  gallery: 12,
}

export function isDataBlockType(type: BlockType): boolean {
  return DATA_BLOCK_TYPES.has(type)
}

export function getDefaultRecordLimitForBlock(type: BlockType): number {
  return DEFAULT_RECORD_LIMIT_BY_TYPE[type] ?? 20
}

export function resolveBlockDisplaySettings(
  blockType: BlockType,
  config: BlockConfig
): ResolvedBlockDisplaySettings {
  const displayMode = (config.display_mode === "fixed" ? "fixed" : "fit") as BlockDisplayMode
  const rawLimit = Number(config.record_limit ?? config.row_limit)
  const recordLimit = Number.isFinite(rawLimit) && rawLimit > 0
    ? Math.floor(rawLimit)
    : getDefaultRecordLimitForBlock(blockType)

  const overflowBehaviour: BlockOverflowBehaviour =
    config.overflow_behaviour === "scroll" || config.overflow_behaviour === "paginate"
      ? config.overflow_behaviour
      : "view_all"

  return {
    displayMode,
    recordLimit,
    overflowBehaviour,
  }
}
