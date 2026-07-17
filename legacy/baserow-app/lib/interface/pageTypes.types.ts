/**
 * Shared types and constants for page types
 * These can be imported by both client and server components
 */

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

