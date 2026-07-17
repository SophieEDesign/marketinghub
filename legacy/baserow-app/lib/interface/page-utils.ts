/**
 * Client-safe utility functions for interface pages
 * These functions don't depend on server-side code
 */

import type { InterfacePage } from './page-types-only'

/**
 * Get the anchor type for a page
 */
export function getPageAnchor(page: InterfacePage): 'saved_view' | 'dashboard' | 'form' | 'record' | null {
  if (page.saved_view_id) return 'saved_view'
  if (page.dashboard_layout_id) return 'dashboard'
  if (page.form_config_id) return 'form'
  if (page.record_config_id) return 'record'
  return null
}

/**
 * Check if a page has a valid anchor
 */
export function hasPageAnchor(page: InterfacePage): boolean {
  return getPageAnchor(page) !== null
}

