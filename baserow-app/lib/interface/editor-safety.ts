/**
 * Editor Safety Guards (Anti-Regression)
 * 
 * Ensures edit mode NEVER mutates persisted data without user interaction.
 * Prevents automatic saves, hydration writes, and layout normalization without user action.
 */

const isDev = typeof window !== 'undefined' && process.env.NODE_ENV === 'development'

// Track user interactions to detect automatic saves
let userInteractionDetected = false
let lastUserInteractionTime = 0

// Track mount time to detect saves during mount
const mountTimes = new Map<string, number>()

/**
 * Mark that user interaction occurred
 * Call this when user clicks, drags, types, etc.
 */
export function markUserInteraction() {
  userInteractionDetected = true
  lastUserInteractionTime = Date.now()
}

/**
 * Check if user interaction occurred recently (within last 100ms)
 */
export function hasRecentUserInteraction(thresholdMs = 100): boolean {
  return userInteractionDetected && (Date.now() - lastUserInteractionTime) < thresholdMs
}

/**
 * Register component mount time
 */
export function registerMount(componentId: string) {
  mountTimes.set(componentId, Date.now())
}

/**
 * Check if save is happening during mount (within 500ms of mount)
 */
export function isSaveDuringMount(componentId: string, thresholdMs = 500): boolean {
  const mountTime = mountTimes.get(componentId)
  if (!mountTime) return false
  return (Date.now() - mountTime) < thresholdMs
}

/**
 * Guard: Prevent saves during mount
 * Returns true if save should be blocked
 */
export function guardAgainstMountSave(componentId: string, operation: string): boolean {
  if (isSaveDuringMount(componentId)) {
    if (isDev) {
      console.warn(
        `[EditorGuard] Blocked ${operation} during mount for ${componentId}. ` +
        `Save occurred ${Date.now() - (mountTimes.get(componentId) || 0)}ms after mount. ` +
        `This indicates an automatic save without user interaction.`
      )
    }
    return true
  }
  return false
}

/**
 * Guard: Prevent saves without user interaction
 * Returns true if save should be blocked
 */
export function guardAgainstAutoSave(operation: string, hasUserInteraction = false): boolean {
  if (!hasUserInteraction && !hasRecentUserInteraction()) {
    if (isDev) {
      console.warn(
        `[EditorGuard] Blocked ${operation} without user interaction. ` +
        `Saves must be triggered by user actions (click, drag, type, etc.).`
      )
    }
    return true
  }
  return false
}

/**
 * Guard: Prevent layout normalization without user drag/resize
 * Returns true if normalization should be blocked
 */
export function guardAgainstAutoNormalization(
  operation: string,
  hasUserDrag = false,
  hasUserResize = false
): boolean {
  if (!hasUserDrag && !hasUserResize) {
    if (isDev) {
      console.warn(
        `[EditorGuard] Blocked ${operation} without user drag/resize. ` +
        `Layout normalization should only occur after user interactions.`
      )
    }
    return true
  }
  return false
}

/**
 * Validate save payload doesn't overwrite unrelated config
 * Returns true if save should be blocked
 */
export function guardAgainstConfigOverwrite(
  currentConfig: Record<string, any>,
  savePayload: Record<string, any>,
  operation: string
): { blocked: boolean; reason?: string } {
  // Check if save payload omits existing config keys (potential data loss)
  const currentKeys = Object.keys(currentConfig)
  const saveKeys = Object.keys(savePayload)
  const omittedKeys = currentKeys.filter(key => !saveKeys.includes(key) && currentConfig[key] !== undefined)

  if (omittedKeys.length > 0 && saveKeys.length > 0) {
    // This might be intentional (partial update), but log for awareness
    if (isDev) {
      console.warn(
        `[EditorGuard] ${operation} omits existing config keys: ${omittedKeys.join(', ')}. ` +
        `Ensure this is intentional and doesn't cause data loss.`
      )
    }
  }

  // Check if base_table is being set to null unintentionally
  if (currentConfig.base_table && savePayload.base_table === null) {
    const reason = 'base_table is being set to null - this may be unintentional'
    if (isDev) {
      console.warn(`[EditorGuard] Blocked ${operation}: ${reason}`)
    }
    return { blocked: true, reason }
  }

  return { blocked: false }
}

/**
 * Validate that save only merges provided fields (shallow merge)
 * Returns validated payload
 */
export function validateShallowMerge(
  currentConfig: Record<string, any>,
  savePayload: Record<string, any>
): Record<string, any> {
  // Ensure we're doing shallow merge, not deep overwrite
  const merged = { ...currentConfig, ...savePayload }
  
  // Warn if savePayload has nested objects that might overwrite entire config sections
  for (const key in savePayload) {
    if (
      typeof savePayload[key] === 'object' &&
      savePayload[key] !== null &&
      !Array.isArray(savePayload[key]) &&
      typeof currentConfig[key] === 'object' &&
      currentConfig[key] !== null
    ) {
      // Check if we're overwriting entire nested object
      const payloadKeys = Object.keys(savePayload[key])
      const currentKeys = Object.keys(currentConfig[key] || {})
      const overwrittenKeys = currentKeys.filter(k => !payloadKeys.includes(k))
      
      if (overwrittenKeys.length > 0 && isDev) {
        console.warn(
          `[EditorGuard] Shallow merge of ${key} may overwrite nested keys: ${overwrittenKeys.join(', ')}. ` +
          `Ensure this is intentional.`
        )
      }
    }
  }

  return merged
}

