/**
 * Interface Pages Library
 * Pages reference SQL views, not templates. All behavior is config-driven.
 */

import { createClient } from '@/lib/supabase/server'
import { PageType, getPageTypeDefinition, validatePageConfig } from './page-types'
import { PageConfig, getDefaultPageConfig } from './page-config'

export interface InterfacePage {
  id: string
  name: string
  page_type: PageType
  source_view: string | null
  base_table: string | null
  config: PageConfig
  group_id: string | null
  order_index: number
  created_at: string
  updated_at: string
  created_by: string | null
  is_admin_only: boolean
}

/**
 * Load an interface page by ID
 */
export async function getInterfacePage(pageId: string): Promise<InterfacePage | null> {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('interface_pages')
    .select('*')
    .eq('id', pageId)
    .maybeSingle()

  if (error) {
    console.error('Error loading interface page:', error)
    return null
  }

  if (!data) return null

  return {
    ...data,
    config: (data.config || {}) as PageConfig,
  }
}

/**
 * Load all interface pages for a group
 */
export async function getInterfacePagesByGroup(groupId: string | null): Promise<InterfacePage[]> {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('interface_pages')
    .select('*')
    .eq('group_id', groupId)
    .order('order_index', { ascending: true })

  if (error) {
    console.error('Error loading interface pages:', error)
    return []
  }

  return (data || []).map(page => ({
    ...page,
    config: (page.config || {}) as PageConfig,
  }))
}

/**
 * Load all interface pages
 */
export async function getAllInterfacePages(): Promise<InterfacePage[]> {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('interface_pages')
    .select('*')
    .order('order_index', { ascending: true })

  if (error) {
    console.error('Error loading interface pages:', error)
    return []
  }

  return (data || []).map(page => ({
    ...page,
    config: (page.config || {}) as PageConfig,
  }))
}

/**
 * Create a new interface page
 */
export async function createInterfacePage(
  name: string,
  pageType: PageType,
  sourceView: string | null = null,
  baseTable: string | null = null,
  config: PageConfig = {},
  groupId: string | null = null
): Promise<InterfacePage> {
  const supabase = await createClient()
  
  // Validate config
  const validation = validatePageConfig(pageType, sourceView, baseTable)
  if (!validation.valid) {
    throw new Error(validation.error)
  }

  // Merge with defaults
  const defaultConfig = getDefaultPageConfig(pageType)
  const mergedConfig = { ...defaultConfig, ...config }

  const { data, error } = await supabase
    .from('interface_pages')
    .insert({
      name,
      page_type: pageType,
      source_view: sourceView,
      base_table: baseTable,
      config: mergedConfig,
      group_id: groupId,
      order_index: 0,
    })
    .select()
    .single()

  if (error) throw error

  return {
    ...data,
    config: (data.config || {}) as PageConfig,
  }
}

/**
 * Update an interface page
 */
export async function updateInterfacePage(
  pageId: string,
  updates: Partial<Pick<InterfacePage, 'name' | 'page_type' | 'source_view' | 'base_table' | 'config' | 'group_id' | 'order_index'>>
): Promise<InterfacePage> {
  const supabase = await createClient()
  
  // If page_type is being updated, validate
  if (updates.page_type) {
    const page = await getInterfacePage(pageId)
    if (page) {
      const validation = validatePageConfig(
        updates.page_type,
        updates.source_view ?? page.source_view,
        updates.base_table ?? page.base_table
      )
      if (!validation.valid) {
        throw new Error(validation.error)
      }
    }
  }

  const { data, error } = await supabase
    .from('interface_pages')
    .update(updates)
    .eq('id', pageId)
    .select()
    .single()

  if (error) throw error

  return {
    ...data,
    config: (data.config || {}) as PageConfig,
  }
}

/**
 * Delete an interface page
 */
export async function deleteInterfacePage(pageId: string): Promise<void> {
  const supabase = await createClient()
  
  const { error } = await supabase
    .from('interface_pages')
    .delete()
    .eq('id', pageId)

  if (error) throw error
}

/**
 * Query a SQL view by name
 * SQL views are first-class citizens - they contain the data and business logic
 */
export async function querySqlView(viewName: string, filters?: Record<string, any>): Promise<any[]> {
  const supabase = await createClient()
  
  // Query the SQL view directly
  // Note: SQL views must be created in Supabase with proper RLS policies
  let query = supabase.from(viewName).select('*')

  // Apply filters if provided
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        query = query.eq(key, value)
      }
    })
  }

  const { data, error } = await query

  if (error) {
    console.error(`Error querying SQL view ${viewName}:`, error)
    throw error
  }

  return data || []
}

/**
 * Get available SQL views for selection
 * This queries the information_schema to find all views
 */
export async function getAvailableSqlViews(): Promise<Array<{ name: string; schema: string }>> {
  const supabase = await createClient()
  
  // Query information_schema to get all views
  const { data, error } = await supabase.rpc('get_available_views')

  if (error) {
    // Fallback: return empty array if RPC doesn't exist
    console.warn('Could not fetch SQL views:', error)
    return []
  }

  return data || []
}

