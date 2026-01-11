/**
 * Normalize any value to an array.
 * 
 * CRITICAL: Grid components assume arrays but sometimes receive:
 * - null or undefined
 * - single objects/records
 * - non-array values
 * 
 * This utility ensures we always have an array before calling
 * array methods like .slice(), .map(), .filter(), etc.
 * 
 * @param value - The value to normalize to an array
 * @returns An array - either the original if already an array, or an empty array
 */
export function asArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) {
    return value
  }
  // Return empty array for null, undefined, or any non-array value
  return []
}

/**
 * Normalize a value to an array, but preserve single objects/records.
 * Useful when an API might return either a single item or an array.
 * 
 * @param value - The value to normalize
 * @returns An array containing the value(s)
 */
export function asArrayPreserveSingle<T>(value: T | T[] | null | undefined): T[] {
  if (Array.isArray(value)) {
    return value
  }
  if (value === null || value === undefined) {
    return []
  }
  // Single object/record - wrap it in an array
  return [value]
}
