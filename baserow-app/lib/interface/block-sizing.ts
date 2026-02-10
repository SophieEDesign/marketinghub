import type { PageBlock, BlockType, BlockSizing } from "./types"

// TODO: As layout containers (e.g. column/section/canvas-in-canvas blocks) are introduced,
// add their BlockType identifiers here so they may legitimately opt into 'fill' sizing.
const FILL_ALLOWED_BLOCK_TYPES: ReadonlyArray<BlockType> = []

export function getRequestedBlockSizing(block: PageBlock): BlockSizing {
  return (block.sizing ?? (block.config as any)?.sizing ?? "content") as BlockSizing
}

/**
 * Compute the effective sizing for a block while enforcing invariants:
 *
 * - Default is always 'content' when unset.
 * - Text / rich editor blocks must NEVER be 'fill'.
 * - Field blocks must NEVER be 'fill'.
 * - Only explicit layout containers may be 'fill' (currently none).
 *
 * When an invalid 'fill' is requested, this function:
 * - Logs a dev-time error explaining why it's being overridden.
 * - Returns 'content' so runtime layout remains safe.
 */
export function getEffectiveBlockSizing(block: PageBlock): BlockSizing {
  const requested = getRequestedBlockSizing(block)

  if (requested !== "fill") {
    // All non-fill requests collapse to 'content' for now.
    return "content"
  }

  const isTextLike = block.type === "text"
  const isFieldLike = block.type === "field"

  // Hard invariants for content blocks
  if (isTextLike || isFieldLike) {
    if (process.env.NODE_ENV === "development") {
      console.error(
        `[BlockSizing] Illegal 'fill' sizing for ${block.type} block ${block.id}. ` +
          `Text and field blocks must always be 'content'-sized. Forcing 'content'.`
      )
    }
    return "content"
  }

  // Only container-style blocks may be 'fill' (none configured yet).
  const isAllowedContainer = FILL_ALLOWED_BLOCK_TYPES.includes(block.type)
  if (!isAllowedContainer) {
    if (process.env.NODE_ENV === "development") {
      console.error(
        `[BlockSizing] Block ${block.id} (${block.type}) requested 'fill' sizing, ` +
          `but only layout container blocks may be 'fill'. Forcing 'content'.`
      )
    }
    return "content"
  }

  return "fill"
}

/**
 * Dev-only hard assertion to prevent regressions when introducing new block types
 * or tweaking sizing rules.
 *
 * Throws in development when a block violates the sizing invariants; no-ops in production.
 */
export function assertBlockSizingInvariant(block: PageBlock): void {
  if (process.env.NODE_ENV !== "development") return

  const requested = getRequestedBlockSizing(block)

  if (requested !== "fill") {
    // 'content' is always safe.
    return
  }

  const isTextLike = block.type === "text"
  const isFieldLike = block.type === "field"
  const isAllowedContainer = FILL_ALLOWED_BLOCK_TYPES.includes(block.type)

  if (isTextLike) {
    throw new Error(
      `[BlockSizingInvariant] TextBlock ${block.id} requested 'fill'. ` +
        `Rich text / editor blocks must never be 'fill'.`
    )
  }

  if (isFieldLike) {
    throw new Error(
      `[BlockSizingInvariant] FieldBlock ${block.id} requested 'fill'. ` +
        `Field blocks must never be 'fill'.`
    )
  }

  if (!isAllowedContainer) {
    throw new Error(
      `[BlockSizingInvariant] Block ${block.id} (${block.type}) requested 'fill', ` +
        `but only explicit layout container blocks may be 'fill'.`
    )
  }
}

