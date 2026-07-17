/**
 * Page Validity Guards
 * 
 * Ensures pages never render in invalid states.
 * Returns validation results without throwing or redirecting.
 * Used by PageRenderer, PageSetupGate, InterfacePageClient.
 */

import type { InterfacePage } from './page-types-only'
import { PageType, getRequiredAnchorType, PAGE_TYPE_DEFINITIONS } from './page-types'
import { getPageAnchor } from './page-utils'

export interface PageValidityResult {
  valid: boolean
  reason?: string
  missingAnchor?: 'saved_view' | 'dashboard' | 'form' | 'record'
  missingTable?: boolean
  missingDateField?: boolean
  missingBlocks?: boolean
}

const isDev = typeof window !== 'undefined' && process.env.NODE_ENV === 'development'

/**
 * Assert that a page is valid before rendering
 * 
 * Unified Canvas + Blocks Architecture:
 * - Pages don't require anchors - blocks define their own data sources
 * - All pages are valid by default (blocks handle their own validation)
 * - Only basic page type validation is performed
 */
export function assertPageIsValid(
  page: InterfacePage,
  options?: {
    hasBlocks?: boolean
    hasTableId?: boolean
    hasDateField?: boolean
  }
): PageValidityResult {
  // Check page type exists
  const definition = PAGE_TYPE_DEFINITIONS[page.page_type]
  if (!definition) {
    const reason = `Unknown page type: ${page.page_type}`
    if (isDev) {
      console.warn(`[PageGuard] Page ${page.id} (${page.name}) is invalid: ${reason}`)
    }
    return {
      valid: false,
      reason,
    }
  }

  // UNIFIED: All pages are valid by default
  // Blocks handle their own data source requirements
  // Pages are just containers that provide context
  return { valid: true }
}

/**
 * Check if page should show setup UI instead of rendering
 */
export function shouldShowSetupUI(
  page: InterfacePage,
  options?: {
    hasBlocks?: boolean
    hasTableId?: boolean
    hasDateField?: boolean
  }
): boolean {
  const validity = assertPageIsValid(page, options)
  return !validity.valid
}

