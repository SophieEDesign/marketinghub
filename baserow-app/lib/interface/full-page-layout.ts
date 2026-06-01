import type { PageBlock } from "@/lib/interface/types"
import { getBlockDefinition } from "@/lib/interface/registry"

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
 * Includes explicit `is_full_page` and legacy social calendar `mode: 'full'`.
 */
export function blockWantsFullPageLayout(block: PageBlock): boolean {
  if (block.config?.is_full_page === true) return true
  if (
    block.type === "social_media_calendar" &&
    block.config?.social_media_calendar_mode === "full"
  ) {
    return true
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
