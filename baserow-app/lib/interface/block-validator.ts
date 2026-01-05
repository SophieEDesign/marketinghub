/**
 * Block Configuration Validator
 * Provides runtime validation for block configs to prevent crashes
 */

import type { BlockType, BlockConfig } from './types'
import { validateBlockConfig } from './block-config-types'

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
 */
export function normalizeBlockConfig(
  blockType: BlockType,
  config: BlockConfig | undefined | null
): BlockConfig {
  const safeConfig: BlockConfig = config || {}

  // Run validation
  const validation = validateBlockConfig(blockType, safeConfig)

  // If invalid, return minimal safe config
  if (!validation.valid) {
    console.warn(`Invalid config for ${blockType} block:`, validation.errors)
    return getDefaultConfigForType(blockType)
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
    table_snapshot: { table_id: '', view_id: '' },
    action: { action_type: 'navigate', label: '' },
    link_preview: { link_url: '' },
    tabs: { tabs: [] },
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

  const validation = validateBlockConfig(blockType, config)
  return validation.valid
}

