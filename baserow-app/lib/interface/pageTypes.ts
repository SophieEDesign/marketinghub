/**
 * Page Type System - Dynamic, Database-Driven Interface Templates
 * 
 * This module provides utilities for working with page type templates.
 * All templates are stored in the database and can be modified without code changes.
 */

import { createClient } from '@/lib/supabase/server'
import type { BlockType, BlockConfig } from './types'

export interface PageTypeTemplate {
  id: string
  type: string
  label: string
  description: string | null
  icon: string | null
  category: 'browse_plan' | 'create_review' | 'insights' | 'advanced' | 'other'
  admin_only: boolean
  default_blocks: BlockDefinition[]
  allowed_blocks: BlockType[]
  order_index: number
  created_at: string
  updated_at: string
}

export interface BlockDefinition {
  type: BlockType
  x: number
  y: number
  w: number
  h: number
  config: BlockConfig
}

export interface PageTypeCategory {
  id: 'browse_plan' | 'create_review' | 'insights' | 'advanced' | 'other'
  label: string
  description: string
  icon: string
}

export const PAGE_TYPE_CATEGORIES: PageTypeCategory[] = [
  {
    id: 'browse_plan',
    label: 'Browse & Plan',
    description: 'Views for exploring and organizing your data',
    icon: '📋',
  },
  {
    id: 'create_review',
    label: 'Create & Review',
    description: 'Pages for data entry and review workflows',
    icon: '✏️',
  },
  {
    id: 'insights',
    label: 'Insights',
    description: 'Dashboards and overviews with analytics',
    icon: '📊',
  },
  {
    id: 'advanced',
    label: 'Advanced',
    description: 'Specialized pages for power users',
    icon: '⚙️',
  },
  {
    id: 'other',
    label: 'Other',
    description: 'Additional page types',
    icon: '📦',
  },
]

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
    .single()

  if (!userIsAdmin) {
    query = query.eq('admin_only', false)
  }

  const { data, error } = await query

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

/**
 * Group templates by category for UI display
 */
export function groupTemplatesByCategory(
  templates: PageTypeTemplate[]
): Record<string, PageTypeTemplate[]> {
  const grouped: Record<string, PageTypeTemplate[]> = {}
  
  templates.forEach((template) => {
    if (!grouped[template.category]) {
      grouped[template.category] = []
    }
    grouped[template.category].push(template)
  })

  return grouped
}

/**
 * Seed blocks from a page type template
 * Replaces placeholder table_id values with the actual primary table ID
 */
export function seedBlocksFromTemplate(
  template: PageTypeTemplate,
  primaryTableId: string
): BlockDefinition[] {
  return template.default_blocks.map((block) => ({
    ...block,
    config: {
      ...block.config,
      // Replace empty table_id with primary table ID
      table_id: block.config.table_id || primaryTableId || '',
    },
  }))
}

