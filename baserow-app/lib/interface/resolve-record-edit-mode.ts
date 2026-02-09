/**
 * Single source of truth for record edit mode resolution.
 * 
 * Rules:
 * - interfaceMode === 'edit' → ALWAYS true (absolute)
 * - else if initialEditMode === true → true
 * - else → false
 * 
 * NO EXCEPTIONS. NO OVERRIDES.
 */
export function resolveRecordEditMode({
  interfaceMode,
  initialEditMode,
}: {
  interfaceMode?: 'view' | 'edit'
  initialEditMode?: boolean
}): boolean {
  // Rule 1: interfaceMode === 'edit' is ABSOLUTE
  if (interfaceMode === 'edit') {
    return true
  }
  
  // Rule 2: initialEditMode can force edit mode
  if (initialEditMode === true) {
    return true
  }
  
  // Rule 3: Default to false
  return false
}
