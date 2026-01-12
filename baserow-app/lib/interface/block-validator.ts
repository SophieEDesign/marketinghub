/**
 * Block Configuration Validator
 * Provides runtime validation for block configs to prevent crashes
 */

import type { BlockType, BlockConfig } from './types'
import { validateBlockConfig } from './block-config-types'

// Re-export validateBlockConfig for convenience
export { validateBlockConfig } from './block-config-types'

/**
 * Safely get a config value with fallback
 */
export function getConfigValue<T>(
  config: BlockConfig | undefined | null,
  key: string,
  defaultValue: T
): T {
  if (!config) return defaultValue
  const value = (config as any)[key]
  return value !== undefined && value !== null ? value : defaultValue
}

/**
 * Validate and normalize block config
 * Returns a safe config object that won't crash the renderer
 * CRITICAL: Preserves content_json for text blocks to prevent data loss
 */
export function normalizeBlockConfig(
  blockType: BlockType,
  config: BlockConfig | undefined | null
): BlockConfig {
  // Ensure config is an object, not an array or other type
  let safeConfig: BlockConfig = {}
  
  if (config && typeof config === 'object' && !Array.isArray(config)) {
    safeConfig = config as BlockConfig
  } else if (config) {
    // If config is not a valid object (e.g., array), silently normalize to empty object
    // This can happen with corrupted or malformed data
    safeConfig = {}
  }

  // CRITICAL: For text blocks, preserve content_json even if validation fails
  // This ensures saved content is never lost during normalization
  const preservedContentJson = blockType === 'text' && (safeConfig as any).content_json

  // Run validation
  const validation = validateBlockConfig(blockType, safeConfig)

  // If invalid, return minimal safe config
  // Silently normalize invalid configs - this is expected for new/incomplete blocks
  if (!validation.valid) {
    const defaultConfig = getDefaultConfigForType(blockType)
    // Preserve content_json for text blocks even when using default config
    if (blockType === 'text' && preservedContentJson !== undefined) {
      return { ...defaultConfig, content_json: preservedContentJson }
    }
    return defaultConfig
  }

  // Ensure content_json is preserved for text blocks
  if (blockType === 'text' && preservedContentJson !== undefined) {
    return { ...safeConfig, content_json: preservedContentJson }
  }

  return safeConfig
}

/**
 * Get default config for a block type
 */
function getDefaultConfigForType(blockType: BlockType): BlockConfig {
  const defaults: Record<BlockType, BlockConfig> = {
    grid: { table_id: '' },
    form: { table_id: '' },
    record: { table_id: '', record_id: '' },
    chart: { table_id: '', chart_type: 'bar' },
    kpi: { table_id: '', kpi_aggregate: 'count' },
    text: { content: '' },
    image: { image_url: '' },
    divider: {},
    button: { button_label: '' },
    action: { action_type: 'navigate', label: '' },
    link_preview: { link_url: '' },
    filter: { target_blocks: 'all', allowed_fields: [], filters: [] },
    field: { field_id: '' },
    calendar: { table_id: '', view_type: 'calendar' },
    kanban: { table_id: '', view_type: 'kanban' },
    timeline: { table_id: '', view_type: 'timeline' },
    list: { table_id: '', view_type: 'grid' },
    number: { table_id: '', field_id: '' },
  }

  return defaults[blockType] || {}
}

/**
 * Check if a block config is complete enough to render
 */
export function isBlockConfigComplete(
  blockType: BlockType,
  config: BlockConfig | undefined | null
): boolean {
  if (!config) return false

  // Image blocks are always valid - they can be empty (show upload prompt)
  if (blockType === 'image') {
    return true
  }

  const validation = validateBlockConfig(blockType, config)
  return validation.valid
}

