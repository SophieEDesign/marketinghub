import type { BlockConfig, PageBlock, BlockType } from "@/lib/interface/types"
import { getBlockDefinition } from "@/lib/interface/registry"

/** Marketing Hub dashboard blocks intended as sole full-view page content. */
export const MARKETING_DASHBOARD_BLOCK_TYPES = [
  "campaigns_overview",
  "things_to_do",
  "content_timeline",
  "event_calendar",
  "social_media_calendar",
  "internal_resource_hub",
] as const satisfies readonly BlockType[]

export type MarketingDashboardBlockType = (typeof MARKETING_DASHBOARD_BLOCK_TYPES)[number]

export function isMarketingDashboardBlockType(
  type: BlockType
): type is MarketingDashboardBlockType {
  return (MARKETING_DASHBOARD_BLOCK_TYPES as readonly string[]).includes(type)
}

/** Block type supports full-page layout in the registry. */
export function blockSupportsFullPage(block: PageBlock): boolean {
  return getBlockDefinition(block.type).supportsFullPage === true
}

/** Record context and similar types need extra config before full-page is valid. */
export function canUseFullPageBlock(block: PageBlock): boolean {
  if (!blockSupportsFullPage(block)) return false
  if (block.type === "record_context") {
    return Boolean(block.config?.table_id)
  }
  return true
}

/**
 * Whether this block should use full-page canvas layout.
 * - Explicit `is_full_page: false` always opts out.
 * - Explicit `is_full_page: true` opts in.
 * - Legacy social `mode: 'full'` opts in.
 * - Marketing dashboard types use registry `defaultFullPage` when flag is unset (existing pages).
 */
/** Resolve full-page from type + config only (settings panel / layout helpers). */
export function configWantsFullPageLayout(
  type: BlockType,
  config?: BlockConfig | null
): boolean {
  if (!config) return false
  return blockWantsFullPageLayout({
    id: "_",
    page_id: "_",
    type,
    x: 0,
    y: 0,
    w: 12,
    h: 12,
    config,
  } as PageBlock)
}

export function blockWantsFullPageLayout(block: PageBlock): boolean {
  const socialLegacyFull =
    block.type === "social_media_calendar" &&
    block.config?.social_media_calendar_mode === "full"
  const flag = block.config?.is_full_page
  if (flag === false && !socialLegacyFull) return false
  if (flag === true || socialLegacyFull) return true
  if (isMarketingDashboardBlockType(block.type)) {
    return getBlockDefinition(block.type).defaultFullPage === true
  }
  return false
}

/** Used when filtering blocks that already have the full-page flag set (invariant cleanup). */
export function isBlockEligibleForFullPage(block: PageBlock): boolean {
  if (!block.config?.is_full_page) return false
  return canUseFullPageBlock(block)
}

/**
 * Single full-page block on a content page, if any.
 * Matches InterfaceBuilder + InterfacePageClient behaviour.
 */
export function resolveFullPageBlockId(blocks: PageBlock[]): string | null {
  if (blocks.length !== 1) return null
  const block = blocks[0]
  if (block?.type === "grid" && block?.config?.view_type === "calendar") {
    return block.id
  }
  if (blockWantsFullPageLayout(block) && canUseFullPageBlock(block)) {
    return block.id
  }
  return null
}

export function pageUsesFullPageLayout(blocks: PageBlock[]): boolean {
  return resolveFullPageBlockId(blocks) != null
}

/** Minimum react-grid-layout row count so full-page blocks do not collapse in edit mode. */
export const FULL_PAGE_GRID_MIN_ROWS = 18

/** Canvas prop and/or block config (marketing defaults, legacy social mode). */
export function resolveBlockUsesFullPageLayout(
  block: PageBlock,
  isFullPageFromCanvas = false
): boolean {
  return isFullPageFromCanvas || blockWantsFullPageLayout(block)
}
