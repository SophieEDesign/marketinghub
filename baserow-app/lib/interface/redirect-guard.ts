/**
 * Redirect Guard
 * 
 * Prevents redirects from happening before page data is loaded.
 * Ensures redirects only occur when explicitly safe.
 */

const isDev = typeof window !== 'undefined' && process.env.NODE_ENV === 'development'

// Track if page data is loaded
let pageDataLoaded = false
let currentPageId: string | null = null

/**
 * Mark that page data has been loaded
 */
export function markPageDataLoaded(pageId: string | null) {
  pageDataLoaded = true
  currentPageId = pageId
  if (isDev) {
    console.log(`[RedirectGuard] Page data loaded: ${pageId || 'none'}`)
  }
}

/**
 * Check if redirect is safe to perform
 * Returns false if redirect would occur before data is loaded
 */
export function canRedirect(
  reason: string,
  targetPageId?: string | null,
  currentUrl?: string
): { allowed: boolean; reason?: string } {
  // Always allow redirects from root path (/)
  if (currentUrl === '/' || currentUrl === undefined) {
    if (isDev) {
      console.log(`[RedirectGuard] Allowing redirect from root: ${reason}`, { targetPageId })
    }
    return { allowed: true }
  }

  // Never redirect away from an explicitly requested page
  if (currentPageId && currentUrl?.includes(`/pages/${currentPageId}`)) {
    if (isDev) {
      console.warn(`[RedirectGuard] Blocked redirect away from explicit page: ${reason}`, {
        currentPageId,
        targetPageId,
        currentUrl,
      })
    }
    return {
      allowed: false,
      reason: `Cannot redirect away from explicitly requested page ${currentPageId}`,
    }
  }

  // Block redirects if page data hasn't loaded yet
  if (!pageDataLoaded && currentUrl !== '/') {
    if (isDev) {
      console.warn(`[RedirectGuard] Blocked redirect before data load: ${reason}`, {
        targetPageId,
        currentUrl,
      })
    }
    return {
      allowed: false,
      reason: 'Page data not loaded yet',
    }
  }

  if (isDev) {
    console.log(`[RedirectGuard] Allowing redirect: ${reason}`, { targetPageId, currentUrl })
  }

  return { allowed: true }
}

/**
 * Log redirect attempt (dev only)
 */
export function logRedirect(reason: string, pageId: string | null, resolved: boolean) {
  if (isDev) {
    console.warn('[Redirect]', { reason, pageId, resolved })
  }
}

