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
 * Validates:
 * - Exactly one anchor exists (saved_view_id, dashboard_layout_id, form_config_id, record_config_id)
 * - Page types that require base_table must have it
 * - Record review pages must have a table AND record source
 * - Dashboard pages must have blocks or show setup state
 * - Calendar pages must have table_id (resolved) and valid date field
 */
export function assertPageIsValid(
  page: InterfacePage,
  options?: {
    hasBlocks?: boolean
    hasTableId?: boolean
    hasDateField?: boolean
  }
): PageValidityResult {
  const { hasBlocks = false, hasTableId = false, hasDateField = false } = options || {}

  // Check anchor validity
  const anchorType = getPageAnchor(page)
  const requiredAnchor = getRequiredAnchorType(page.page_type)
  
  // Content pages don't require anchors initially
  if (page.page_type === 'content') {
    return { valid: true }
  }

  // Check if required anchor exists
  if (requiredAnchor) {
    if (!anchorType) {
      const reason = `${page.page_type} pages require a ${requiredAnchor} anchor`
      if (isDev) {
        console.warn(`[PageGuard] Page ${page.id} (${page.name}) is invalid: ${reason}`)
      }
      return {
        valid: false,
        reason,
        missingAnchor: requiredAnchor,
      }
    }

    if (anchorType !== requiredAnchor) {
      const reason = `${page.page_type} pages require ${requiredAnchor} anchor, but found ${anchorType}`
      if (isDev) {
        console.warn(`[PageGuard] Page ${page.id} (${page.name}) is invalid: ${reason}`)
      }
      return {
        valid: false,
        reason,
        missingAnchor: requiredAnchor,
      }
    }
  }

  // Ensure exactly one anchor (for non-content pages)
  const anchorCount = [
    page.saved_view_id,
    page.dashboard_layout_id,
    page.form_config_id,
    page.record_config_id,
  ].filter(Boolean).length

  // Content pages don't require anchors initially
  // Check page_type as string to avoid TypeScript narrowing issues
  const isContentPage = String(page.page_type) === 'content'
  if (anchorCount === 0 && !isContentPage) {
    const reason = 'Page must have exactly one anchor'
    if (isDev) {
      console.warn(`[PageGuard] Page ${page.id} (${page.name}) is invalid: ${reason}`)
    }
    return {
      valid: false,
      reason,
    }
  }

  if (anchorCount > 1) {
    const reason = `Page has ${anchorCount} anchors, but must have exactly one`
    if (isDev) {
      console.warn(`[PageGuard] Page ${page.id} (${page.name}) is invalid: ${reason}`)
    }
    return {
      valid: false,
      reason,
    }
  }

  // Check page type requirements
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

  // Pages that require base_table
  if (definition.requiresBaseTable) {
    if (!hasTableId && !page.base_table) {
      const reason = `${page.page_type} pages require a base_table`
      if (isDev) {
        console.warn(`[PageGuard] Page ${page.id} (${page.name}) is invalid: ${reason}`)
      }
      return {
        valid: false,
        reason,
        missingTable: true,
      }
    }
  }

  // Record review pages must have table AND record source
  if (page.page_type === 'record_review') {
    if (!hasTableId && !page.base_table) {
      const reason = 'Record review pages require a base_table'
      if (isDev) {
        console.warn(`[PageGuard] Page ${page.id} (${page.name}) is invalid: ${reason}`)
      }
      return {
        valid: false,
        reason,
        missingTable: true,
      }
    }
  }

  // Calendar pages must have date field
  if (page.page_type === 'calendar') {
    if (!hasDateField) {
      const reason = 'Calendar pages require a valid date field'
      if (isDev) {
        console.warn(`[PageGuard] Page ${page.id} (${page.name}) is invalid: ${reason}`)
      }
      return {
        valid: false,
        reason,
        missingDateField: true,
      }
    }
  }

  // Dashboard/overview pages should have blocks (but can show setup state)
  if (['dashboard', 'overview'].includes(page.page_type)) {
    if (!hasBlocks && page.dashboard_layout_id) {
      // Has layout ID but no blocks - might be in setup state
      // This is valid, but log for diagnostics
      if (isDev) {
        console.warn(`[PageGuard] Page ${page.id} (${page.name}) has dashboard_layout_id but no blocks - showing setup state`)
      }
    }
  }

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

