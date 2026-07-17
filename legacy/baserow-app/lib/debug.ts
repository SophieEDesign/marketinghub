/**
 * Production-gated debug helpers
 * No console output in production unless NEXT_PUBLIC_DEBUG=1
 */

const isDebugAllowed = () =>
  process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_DEBUG === '1'

export function debugLog(...args: unknown[]) {
  if (isDebugAllowed()) console.log(...args)
}

export function debugWarn(...args: unknown[]) {
  if (isDebugAllowed()) console.warn(...args)
}

export function debugError(...args: unknown[]) {
  if (isDebugAllowed()) console.error(...args)
}
