/**
 * Pure helpers for canvas edit chrome (toolbar visibility, full-page affordances).
 */

export function shouldShowBlockChromeToolbar(params: {
  isEditing: boolean
  isFullPageMode: boolean
  isThisFullPageBlock: boolean
  isBlockSelected: boolean
}): boolean {
  const { isEditing, isFullPageMode, isThisFullPageBlock, isBlockSelected } = params
  if (!isEditing) return false
  return isBlockSelected || isThisFullPageBlock || !isFullPageMode
}

export function isCanvasFullPageMode(
  fullPageBlockId: string | null | undefined,
  blocks: { id: string }[]
): boolean {
  return Boolean(
    fullPageBlockId && blocks.length === 1 && blocks[0]?.id === fullPageBlockId
  )
}
