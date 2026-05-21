/**
 * Single source of truth for record edit mode resolution.
 * 
 * Rules:
 * - interfaceMode === 'edit' → ALWAYS true (absolute)
 * - else if initialEditMode === true → true
 * - else if pageLayoutEditActive → true (UIMode edit + layout save handler on panel)
 * - else → false
 */
export function resolveRecordEditMode({
  interfaceMode,
  initialEditMode,
  pageLayoutEditActive,
}: {
  interfaceMode?: 'view' | 'edit'
  initialEditMode?: boolean
  /** UIMode page edit with record layout save (RecordPanel). */
  pageLayoutEditActive?: boolean
}): boolean {
  if (interfaceMode === 'edit') {
    return true
  }
  if (initialEditMode === true) {
    return true
  }
  if (pageLayoutEditActive === true) {
    return true
  }
  return false
}
