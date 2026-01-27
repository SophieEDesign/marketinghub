/**
 * Block Defaults API
 * 
 * Single source of truth for block defaults and inheritance.
 * All block creation should use these functions.
 */

import type { BlockType, BlockConfig } from '@/lib/interface/types'
import { BLOCK_REGISTRY, getBlockDefinition } from '@/lib/interface/registry'
import type { SectionSettings } from './types'
import { getTableSections } from './section-settings'
import { createClient } from '@/lib/supabase/client'
import type { TableField } from '@/types/fields'

/**
 * Get block defaults from registry
 * 
 * This is the single source of truth for block defaults.
 * All components should use this instead of hardcoding defaults.
 */
export function getBlockDefaults(type: BlockType): BlockConfig {
  const definition = getBlockDefinition(type)
  
  if (!definition) {
    console.warn(`No block definition found for type: ${type}`)
    return {}
  }
  
  // Return a deep copy to avoid mutations
  return JSON.parse(JSON.stringify(definition.defaultConfig))
}

/**
 * Create block with defaults
 * 
 * Creates a new block config with defaults applied.
 * Optionally merges in overrides.
 */
export function createBlockWithDefaults(
  type: BlockType,
  overrides?: Partial<BlockConfig>
): BlockConfig {
  const defaults = getBlockDefaults(type)
  
  // Merge overrides into defaults
  return {
    ...defaults,
    ...overrides,
    // Deep merge appearance if both exist
    ...(defaults.appearance && overrides?.appearance ? {
      appearance: {
        ...defaults.appearance,
        ...overrides.appearance,
      },
    } : {}),
  }
}

/**
 * Inherit block settings from fields and sections
 * 
 * When creating a block for a table, automatically inherit:
 * - Field groupings from table sections
 * - Default field visibility
 * - Default section settings
 */
export async function inheritBlockSettings(
  blockType: BlockType,
  tableId: string,
  baseConfig?: BlockConfig
): Promise<BlockConfig> {
  const definition = getBlockDefinition(blockType)
  
  if (!definition) {
    return baseConfig || {}
  }
  
  // Start with base config or defaults
  const config = baseConfig || getBlockDefaults(blockType)
  
  // Only inherit if block type supports fields
  if (definition.applicableSettings?.fields !== true) {
    return config
  }
  
  // Get table sections
  const sections = await getTableSections(tableId)
  
  // Get table fields
  const supabase = createClient()
  const { data: fields } = await supabase
    .from('table_fields')
    .select('*')
    .eq('table_id', tableId)
    .order('order_index', { ascending: true })
  
  if (!fields || fields.length === 0) {
    return config
  }
  
  const tableFields = fields as TableField[]
  
  // For data blocks (grid, list, kanban, etc.), auto-apply field groupings
  if (blockType === 'grid' || blockType === 'list' || blockType === 'kanban' || 
      blockType === 'calendar' || blockType === 'timeline' || blockType === 'gallery') {
    // Auto-apply section-based field groupings if sections exist
    if (sections.length > 0) {
      // Group fields by section
      const fieldsBySection = new Map<string, TableField[]>()
      
      for (const field of tableFields) {
        const sectionName = field.group_name || 'General'
        if (!fieldsBySection.has(sectionName)) {
          fieldsBySection.set(sectionName, [])
        }
        fieldsBySection.get(sectionName)!.push(field)
      }
      
      // For list blocks, auto-apply title field from first section
      if (blockType === 'list' && !config.list_title_field) {
        const firstSection = Array.from(fieldsBySection.values())[0]
        if (firstSection && firstSection.length > 0) {
          const titleField = firstSection.find(f => 
            ['text', 'long_text', 'email', 'url'].includes(f.type)
          ) || firstSection[0]
          
          return {
            ...config,
            list_title_field: titleField.name,
          }
        }
      }
    }
  }
  
  return config
}

/**
 * Get applicable settings for a block type
 * 
 * Returns which settings apply to a given block type.
 */
export function getApplicableSettings(blockType: BlockType) {
  const definition = getBlockDefinition(blockType)
  return definition.applicableSettings || {
    fields: false,
    filters: false,
    sorts: false,
    grouping: false,
    appearance: true, // Most blocks support appearance
    permissions: false,
    conditionalFormatting: false,
  }
}

/**
 * Check if a setting is excluded for a block type
 * 
 * Returns true if the setting should not be used for this block type.
 */
export function isSettingExcluded(blockType: BlockType, settingName: string): boolean {
  const definition = getBlockDefinition(blockType)
  return definition.excludedSettings?.includes(settingName) || false
}
