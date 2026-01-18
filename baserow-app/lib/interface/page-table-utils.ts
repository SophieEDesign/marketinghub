/**
 * Page Table Utilities
 * Helper functions to extract tableId from pages
 * 
 * Core Rule: Every data-backed page must have a table reference.
 * Tables flow: Table -> View (internal) -> Page -> Blocks
 */

import { createClient } from '@/lib/supabase/client'
import type { InterfacePage } from './page-types-only'
import { VIEWS_ENABLED } from '@/lib/featureFlags'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function isUuidLike(value: string | null | undefined): value is string {
  return typeof value === 'string' && UUID_RE.test(value)
}

/**
 * Extract tableId from a page
 * Priority:
 * 1. base_table (if it's a UUID, treat as table ID)
 * 2. saved_view_id -> view -> table_id
 * 3. form_config_id (if it's a UUID, treat as table ID)
 * 
 * Returns null if no table can be found
 */
export async function getPageTableId(page: InterfacePage): Promise<string | null> {
  // First check base_table - if it's a UUID, it's a table ID
  if (page.base_table) {
    // Check if it looks like a UUID (36 chars with dashes)
    if (isUuidLike(page.base_table)) {
      return page.base_table
    }
    // Otherwise it might be a table name (or supabase_table) - resolve to ID.
    try {
      const supabase = createClient()
      const byName = await supabase
        .from('tables')
        .select('id')
        .eq('name', page.base_table)
        .maybeSingle()
      if (!byName.error && byName.data?.id) {
        return byName.data.id
      }

      const bySupabaseTable = await supabase
        .from('tables')
        .select('id')
        .eq('supabase_table', page.base_table)
        .maybeSingle()
      if (!bySupabaseTable.error && bySupabaseTable.data?.id) {
        return bySupabaseTable.data.id
      }
    } catch (error) {
      console.warn('Error resolving base_table to table ID:', error)
    }
  }

  // Check form_config_id - if it's a UUID, it's a table ID
  if (page.form_config_id) {
    if (isUuidLike(page.form_config_id)) {
      return page.form_config_id
    }
  }

  // Check saved_view_id -> view -> table_id
  if (page.saved_view_id) {
    // RULE: Views are currently not used; do not resolve table_id via views unless explicitly enabled.
    if (!VIEWS_ENABLED) {
      return null
    }
    try {
      const supabase = createClient()
      const { data: view, error } = await supabase
        .from('views')
        .select('table_id')
        .eq('id', page.saved_view_id)
        .maybeSingle()

      if (!error && view?.table_id) {
        return view.table_id
      }
    } catch (error) {
      console.warn('Error fetching table_id from view:', error)
    }
  }

  return null
}

/**
 * Extract tableId from a page (synchronous version using cached data)
 * Use this when you already have the view data
 */
export function getPageTableIdSync(
  page: InterfacePage,
  viewData?: { table_id: string | null }
): string | null {
  // Check base_table
  if (page.base_table) {
    if (isUuidLike(page.base_table)) {
      return page.base_table
    }
  }

  // Check form_config_id
  if (page.form_config_id) {
    if (isUuidLike(page.form_config_id)) {
      return page.form_config_id
    }
  }

  // Use provided view data
  if (viewData?.table_id) {
    return viewData.table_id
  }

  return null
}

/**
 * Check if a page requires a table
 */
export function pageRequiresTable(pageType: string): boolean {
  // Content pages don't require tables
  if (pageType === 'content') {
    return false
  }
  
  // All other page types require a table
  return true
}

/**
 * Validate that a page has a table connection
 */
export async function validatePageHasTable(page: InterfacePage): Promise<{
  valid: boolean
  tableId: string | null
  error?: string
}> {
  if (!pageRequiresTable(page.page_type)) {
    return { valid: true, tableId: null }
  }

  const tableId = await getPageTableId(page)
  
  if (!tableId) {
    return {
      valid: false,
      tableId: null,
      error: `Page "${page.name}" is missing a table connection. Please configure it in Settings.`
    }
  }

  return { valid: true, tableId }
}

