/**
 * Block Configuration Validator
 * Provides runtime validation for block configs to prevent crashes
 */

import type { BlockType, BlockConfig } from './types'
import { validateBlockConfig } from './block-config-types'
import { BLOCK_REGISTRY } from './registry'

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
    safeConfig = canonicalizeConfigKeys(config as BlockConfig)
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

function canonicalizeConfigKeys(config: BlockConfig): BlockConfig {
  const next: Record<string, unknown> = { ...(config as Record<string, unknown>) }

  // Canonical source keys
  if (next.table_id == null && next.tableId != null) next.table_id = next.tableId
  if (next.view_id == null && next.viewId != null) next.view_id = next.viewId
  if (next.table_id == null && next.sourceTableId != null) next.table_id = next.sourceTableId
  if (next.view_id == null && next.sourceViewId != null) next.view_id = next.sourceViewId

  // Common field key migration pattern: fooFieldId -> foo_field_id
  for (const key of Object.keys(next)) {
    if (!key.endsWith('FieldId')) continue
    const snake = key.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase()
    if (next[snake] == null && next[key] != null) {
      next[snake] = next[key]
    }
  }

  delete next.tableId
  delete next.viewId
  delete next.sourceTableId
  delete next.sourceViewId

  return next as BlockConfig
}

/**
 * Get default config for a block type
 * 
 * Uses BLOCK_REGISTRY as the single source of truth for block defaults.
 * This ensures consistency between block creation and validation fallbacks.
 */
function getDefaultConfigForType(blockType: BlockType): BlockConfig {
  // Use registry as single source of truth
  const definition = BLOCK_REGISTRY[blockType]
  
  if (definition && definition.defaultConfig) {
    // Return a deep copy to avoid mutations
    return JSON.parse(JSON.stringify(definition.defaultConfig))
  }
  
  // Fallback for unknown block types
  return {}
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

  // Content theme / timeline / upcoming summary blocks always render with mock data
  if (
    blockType === 'content_theme' ||
    blockType === 'content_timeline' ||
    blockType === 'upcoming_summary' ||
    blockType === 'kpi_summary' ||
    blockType === 'internal_resource_hub' ||
    blockType === 'things_to_do' ||
    blockType === 'event_calendar' ||
    blockType === 'social_media_calendar'
  ) {
    return true
  }

  const validation = validateBlockConfig(blockType, config)
  return validation.valid
}

