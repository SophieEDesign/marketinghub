/**
 * Page Type System - Server-Side Utilities
 * 
 * This module provides server-side utilities for working with page type templates.
 * All templates are stored in the database and can be modified without code changes.
 * 
 * For client-side code, use pageTypes.types.ts for types and constants,
 * and pageTypes.client.ts for client-side functions.
 */

import { createClient } from '@/lib/supabase/server'
import type { PageTypeTemplate } from './pageTypes.types'

// Re-export types for convenience
export type { PageTypeTemplate, BlockDefinition, PageTypeCategory } from './pageTypes.types'
export { PAGE_TYPE_CATEGORIES, groupTemplatesByCategory, seedBlocksFromTemplate } from './pageTypes.types'

/**
 * Fetch all page type templates from the database
 * Filters by user role (admin_only templates only visible to admins)
 */
export async function getPageTypeTemplates(userIsAdmin: boolean = false): Promise<PageTypeTemplate[]> {
  const supabase = await createClient()
  
  let query = supabase
    .from('page_type_templates')
    .select('*')
    .order('category', { ascending: true })
    .order('order_index', { ascending: true })

  // Filter out admin-only templates for non-admins
  if (!userIsAdmin) {
    query = query.eq('admin_only', false)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error loading page type templates:', error)
    return []
  }

  // Parse JSONB fields
  return (data || []).map((template: any) => ({
    ...template,
    default_blocks: Array.isArray(template.default_blocks) 
      ? template.default_blocks 
      : JSON.parse(template.default_blocks || '[]'),
    allowed_blocks: Array.isArray(template.allowed_blocks)
      ? template.allowed_blocks
      : JSON.parse(template.allowed_blocks || '[]'),
  })) as PageTypeTemplate[]
}

/**
 * Get a single page type template by type
 */
export async function getPageTypeTemplate(
  type: string,
  userIsAdmin: boolean = false
): Promise<PageTypeTemplate | null> {
  const supabase = await createClient()
  
  let query = supabase
    .from('page_type_templates')
    .select('*')
    .eq('type', type)

  // Filter out admin-only templates for non-admins (before .single())
  if (!userIsAdmin) {
    query = query.eq('admin_only', false)
  }

  const { data, error } = await query.single()

  if (error || !data) {
    return null
  }

  return {
    ...data,
    default_blocks: Array.isArray(data.default_blocks)
      ? data.default_blocks
      : JSON.parse(data.default_blocks || '[]'),
    allowed_blocks: Array.isArray(data.allowed_blocks)
      ? data.allowed_blocks
      : JSON.parse(data.allowed_blocks || '[]'),
  } as PageTypeTemplate
}


