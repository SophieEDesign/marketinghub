/**
 * DEBUG flags for interface lifecycle debugging
 * Enable via localStorage flags:
 * - localStorage.setItem('DEBUG_LAYOUT', '1')
 * - localStorage.setItem('DEBUG_TEXT', '1')
 * - localStorage.setItem('DEBUG_CALENDAR', '1')
 * - localStorage.setItem('DEBUG_LIST', '1')
 * - localStorage.setItem('DEBUG_RECORD', '1')
 * 
 * Or enable all: localStorage.setItem('DEBUG_ALL', '1')
 */

export type DebugFlag = 'LAYOUT' | 'TEXT' | 'CALENDAR' | 'LIST' | 'RECORD'

export function isDebugEnabled(flag: DebugFlag): boolean {
  if (typeof window === 'undefined') return false
  // Check for DEBUG_ALL flag
  if (localStorage.getItem('DEBUG_ALL') === '1') return true
  return localStorage.getItem(`DEBUG_${flag}`) === '1'
}

export function debugLog(flag: DebugFlag, message: string, data?: any) {
  if (isDebugEnabled(flag)) {
    console.log(`[DEBUG ${flag}] ${message}`, data || '')
  }
}

export function debugWarn(flag: DebugFlag, message: string, data?: any) {
  if (isDebugEnabled(flag)) {
    console.warn(`[DEBUG ${flag}] ${message}`, data || '')
  }
}

export function debugError(flag: DebugFlag, message: string, data?: any) {
  if (isDebugEnabled(flag)) {
    console.error(`[DEBUG ${flag}] ${message}`, data || '')
  }
}
