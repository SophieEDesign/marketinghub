/**
 * Interface Pages Library
 * Pages reference SQL views, not templates. All behavior is config-driven.
 */

import { createClient } from '@/lib/supabase/server'
import { PageType, getPageTypeDefinition, validatePageConfig, validatePageAnchor, getRequiredAnchorType } from './page-types'
import { PageConfig, getDefaultPageConfig } from './page-config'

export interface InterfacePage {
  id: string
  name: string
  page_type: PageType
  source_view: string | null // Deprecated: use saved_view_id instead
  base_table: string | null // Deprecated: use form_config_id instead
  config: PageConfig
  group_id: string | null
  order_index: number
  created_at: string
  updated_at: string
  created_by: string | null
  is_admin_only: boolean
  // Page anchors - exactly one must be set
  saved_view_id: string | null // For list/gallery/kanban/calendar/timeline/record_review
  dashboard_layout_id: string | null // For dashboard/overview (references view_blocks.view_id)
  form_config_id: string | null // For form pages
  record_config_id: string | null // For record_review pages
}

// Note: getPageAnchor and hasPageAnchor moved to page-utils.ts for client-side use

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
    .order('created_at', { ascending: true }) // Secondary sort for consistency

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
    .order('created_at', { ascending: true }) // Secondary sort for consistency

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

  // Determine required anchor and set anchor fields
  const requiredAnchor = getRequiredAnchorType(pageType)
  let saved_view_id: string | null = null
  let dashboard_layout_id: string | null = null
  let form_config_id: string | null = null
  const record_config_id: string | null = null

  switch (requiredAnchor) {
    case 'saved_view':
      if (!sourceView) {
        throw new Error(`${pageType} pages require a source view (saved_view_id)`)
      }
      saved_view_id = sourceView
      break
    case 'dashboard':
      // Use temporary UUID that will be updated to page ID after creation
      dashboard_layout_id = crypto.randomUUID()
      break
    case 'form':
      if (!baseTable) {
        throw new Error(`${pageType} pages require a base table (form_config_id)`)
      }
      form_config_id = baseTable
      break
    case 'record':
      // record_review actually uses saved_view anchor, but handle this case defensively
      if (!sourceView) {
        throw new Error(`${pageType} pages require a source view`)
      }
      saved_view_id = sourceView
      break
  }

  // Ensure group_id is set (required after migration)
  let finalGroupId = groupId
  if (!finalGroupId) {
    // Get or create default "Ungrouped" group
    const { data: defaultGroup } = await supabase
      .from('interface_groups')
      .select('id')
      .or('name.eq.Ungrouped,is_system.eq.true')
      .order('is_system', { ascending: false })
      .limit(1)
      .maybeSingle()
    
    if (defaultGroup) {
      finalGroupId = defaultGroup.id
    } else {
      // Create "Ungrouped" group if it doesn't exist
      const { data: newGroup, error: groupError } = await supabase
        .from('interface_groups')
        .insert([{ name: 'Ungrouped', order_index: 9999, collapsed: false, is_system: true }])
        .select('id')
        .single()
      
      if (groupError) {
        throw new Error(`Failed to get or create default group: ${groupError.message}`)
      }
      
      if (newGroup) {
        finalGroupId = newGroup.id
      } else {
        throw new Error('Failed to get or create default group for interface page')
      }
    }
  }

  const { data, error } = await supabase
    .from('interface_pages')
    .insert({
      name,
      page_type: pageType,
      source_view: sourceView,
      base_table: baseTable,
      saved_view_id,
      dashboard_layout_id,
      form_config_id,
      record_config_id,
      config: mergedConfig,
      group_id: finalGroupId, // Always set - required after migration
      order_index: 0,
    })
    .select()
    .single()

  if (error) throw error

  // For dashboard pages, update dashboard_layout_id to the page's own ID (self-reference)
  // Note: 'overview' is not a valid PageType in unified architecture
  if (requiredAnchor === 'dashboard' && data) {
    const { error: updateError } = await supabase
      .from('interface_pages')
      .update({ dashboard_layout_id: data.id })
      .eq('id', data.id)
    
    if (updateError) {
      throw new Error(`Failed to set dashboard layout: ${updateError.message}`)
    }

    // Return updated data
    const { data: updatedData } = await supabase
      .from('interface_pages')
      .select('*')
      .eq('id', data.id)
      .single()

    if (updatedData) {
      return {
        ...updatedData,
        config: (updatedData.config || {}) as PageConfig,
      }
    }
  }

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
  
  // First check if page exists
  const existingPage = await getInterfacePage(pageId)
  if (!existingPage) {
    throw new Error('Page not found')
  }

  // Ensure interface_id (group_id) is always set - cannot be null
  if (updates.group_id === null || updates.group_id === undefined) {
    // If trying to clear group_id, keep existing value
    if (existingPage.group_id) {
      // Keep existing group_id
    } else {
      throw new Error('Page must have an interface (group_id) assigned')
    }
  }

  // If page_type is being updated, validate
  if (updates.page_type) {
    const validation = validatePageConfig(
      updates.page_type,
      updates.source_view ?? existingPage.source_view,
      updates.base_table ?? existingPage.base_table
    )
    if (!validation.valid) {
      throw new Error(validation.error)
    }
  }

  // Validate that data-backed pages have table_id (base_table)
  const pageType = updates.page_type ?? existingPage.page_type
  const baseTable = updates.base_table ?? existingPage.base_table
  const definition = getPageTypeDefinition(pageType)
  
  if (definition.requiresBaseTable && !baseTable) {
    throw new Error(`${definition.label} page type requires a table connection (base_table)`)
  }

  // Prepare update with updated_at timestamp
  // CRITICAL: Only include fields that are explicitly being updated
  // Never send undefined/null for config unless explicitly clearing it
  const updateData: Record<string, any> = {
    updated_at: new Date().toISOString(),
  }
  
  // Only include fields that are in updates (defensive merge)
  if (updates.name !== undefined) updateData.name = updates.name
  if (updates.page_type !== undefined) updateData.page_type = updates.page_type
  if (updates.source_view !== undefined) updateData.source_view = updates.source_view
  if (updates.base_table !== undefined) updateData.base_table = updates.base_table
  if (updates.group_id !== undefined) updateData.group_id = updates.group_id
  if (updates.order_index !== undefined) updateData.order_index = updates.order_index
  // CRITICAL: Only update config if explicitly provided (preserve existing config otherwise)
  if (updates.config !== undefined) updateData.config = updates.config

  const { data, error } = await supabase
    .from('interface_pages')
    .update(updateData)
    .eq('id', pageId)
    .select()
    .single()

  if (error) {
    // If error is about no rows found, provide a clearer message
    if (error.code === 'PGRST116' || error.message?.includes('0 rows')) {
      throw new Error('Page not found or you do not have permission to update it')
    }
    throw error
  }

  if (!data) {
    throw new Error('Page not found after update')
  }

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
  
  // Check if this page is set as default interface before deleting
  // Clear default_interface_id if this page is the default
  try {
    const { data: workspaceSettings } = await supabase
      .from('workspace_settings')
      .select('id, default_interface_id')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (workspaceSettings?.default_interface_id === pageId) {
      // Clear the default_interface_id before deleting
      await supabase
        .from('workspace_settings')
        .update({ default_interface_id: null })
        .eq('id', workspaceSettings.id)
    }
  } catch (settingsError: any) {
    // Silently ignore errors - column might not exist or RLS might block
    // The ON DELETE SET NULL constraint will handle it anyway
    if (settingsError?.code !== 'PGRST116' && settingsError?.code !== '42P01') {
      console.warn('Could not clear default_interface_id:', settingsError)
    }
  }
  
  const { error, data } = await supabase
    .from('interface_pages')
    .delete()
    .eq('id', pageId)
    .select()

  if (error) {
    console.error('Error deleting interface page:', error)
    // Provide more helpful error messages
    if (error.code === 'PGRST301' || error.message?.includes('permission') || error.message?.includes('policy')) {
      throw new Error('You do not have permission to delete this page. Please ensure you are logged in and have the necessary permissions.')
    }
    if (error.code === 'PGRST116' || error.message?.includes('0 rows')) {
      throw new Error('Page not found or already deleted')
    }
    throw new Error(error.message || 'Failed to delete page')
  }

  // Check if page was actually deleted
  if (!data || data.length === 0) {
    throw new Error('Page not found or already deleted')
  }
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

