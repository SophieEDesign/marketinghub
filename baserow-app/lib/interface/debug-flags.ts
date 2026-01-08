/**
 * DEBUG flags for interface lifecycle debugging
 * Enable via localStorage flags:
 * - localStorage.setItem('DEBUG_LAYOUT', '1')
 * - localStorage.setItem('DEBUG_TEXT', '1')
 * - localStorage.setItem('DEBUG_CALENDAR', '1')
 */

export function isDebugEnabled(flag: 'LAYOUT' | 'TEXT' | 'CALENDAR'): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(`DEBUG_${flag}`) === '1'
}

export function debugLog(flag: 'LAYOUT' | 'TEXT' | 'CALENDAR', message: string, data?: any) {
  if (isDebugEnabled(flag)) {
    console.log(`[DEBUG ${flag}] ${message}`, data || '')
  }
}

export function debugWarn(flag: 'LAYOUT' | 'TEXT' | 'CALENDAR', message: string, data?: any) {
  if (isDebugEnabled(flag)) {
    console.warn(`[DEBUG ${flag}] ${message}`, data || '')
  }
}

export function debugError(flag: 'LAYOUT' | 'TEXT' | 'CALENDAR', message: string, data?: any) {
  if (isDebugEnabled(flag)) {
    console.error(`[DEBUG ${flag}] ${message}`, data || '')
  }
}
