/**
 * Client-side utilities for page types
 * These functions use the browser Supabase client
 */

import { createClient } from '@/lib/supabase/client'
import type { PageTypeTemplate, BlockDefinition } from './pageTypes.types'
import { seedBlocksFromTemplate as seedBlocksFromTemplateShared } from './pageTypes.types'

/**
 * Fetch all page type templates from the database (client-side)
 */
export async function getPageTypeTemplatesClient(userIsAdmin: boolean = false): Promise<PageTypeTemplate[]> {
  const supabase = createClient()
  
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
 * Seed blocks from a page type template (client-side)
 * Re-export shared function for convenience
 */
export { seedBlocksFromTemplateShared as seedBlocksFromTemplate }

