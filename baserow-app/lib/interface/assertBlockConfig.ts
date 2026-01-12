/**
 * Block Config Assertions
 * 
 * Ensures blocks never render with incomplete or unsafe config.
 * Returns validation results without crashing.
 * Used by BlockRenderer and block components.
 */

import type { BlockConfig } from './types'
import type { BlockType } from './types'

const isDev = typeof window !== 'undefined' && process.env.NODE_ENV === 'development'

export interface BlockConfigValidityResult {
  valid: boolean
  reason?: string
  missingFields?: string[]
  showSetupUI?: boolean
}

/**
 * Assert that a block config is valid for rendering
 * 
 * Validates per block type:
 * - Grid / Calendar / Chart / KPI: table_id must exist
 * - Calendar: date field must exist and resolve to field name
 * - Record block: record_id OR pageRecordId must exist
 * - Text block: content_json must exist OR show setup UI
 */
export function assertBlockConfig(
  blockType: BlockType,
  config: BlockConfig | undefined | null,
  options?: {
    pageTableId?: string | null
    pageRecordId?: string | null
    hasDateField?: boolean
  }
): BlockConfigValidityResult {
  const { pageTableId = null, pageRecordId = null, hasDateField = false } = options || {}

  if (!config || typeof config !== 'object') {
    const reason = `Block config is missing or invalid`
    if (isDev) {
      console.warn(`[BlockGuard] Block type ${blockType} has invalid config: ${reason}`)
    }
    return {
      valid: false,
      reason,
      showSetupUI: true,
    }
  }

  const missingFields: string[] = []

  switch (blockType) {
    case 'grid':
      // Grid blocks MUST have table_id configured - no fallback
      // Calendar views are grid blocks with view_type: 'calendar'
      if (!config.table_id && !config.source_view) {
        missingFields.push('table_id or source_view')
        const reason = `${blockType} block requires table_id or source_view`
        if (isDev) {
          console.warn(`[BlockGuard] ${blockType} block is missing required config: ${reason}`)
        }
        return {
          valid: false,
          reason,
          missingFields,
          showSetupUI: true,
        }
      }
      // Calendar views (grid blocks with view_type: 'calendar') also need date field
      // Check for all possible date field config properties
      const hasDateFieldConfig = !!(
        config.start_date_field ||
        config.from_date_field ||
        config.date_field ||
        config.calendar_date_field ||
        config.calendar_start_field ||
        hasDateField
      )
      if (config.view_type === 'calendar' && !hasDateFieldConfig) {
        missingFields.push('start_date_field or from_date_field')
        const reason = 'Calendar view (grid block) requires a date field'
        if (isDev) {
          console.warn(`[BlockGuard] Calendar view block is missing date field`)
        }
        return {
          valid: false,
          reason,
          missingFields,
          showSetupUI: true,
        }
      }
      break

    case 'chart':
    case 'kpi':
      // Chart and KPI blocks MUST have table_id configured - no fallback
      if (!config.table_id && !config.source_view) {
        missingFields.push('table_id or source_view')
        const reason = `${blockType} block requires table_id or source_view`
        if (isDev) {
          console.warn(`[BlockGuard] ${blockType} block is missing required config: ${reason}`)
        }
        return {
          valid: false,
          reason,
          missingFields,
          showSetupUI: true,
        }
      }
      break

    case 'record':
      // Record block MUST have table_id AND (record_id OR pageRecordId)
      if (!config.table_id && !pageTableId) {
        missingFields.push('table_id')
        const reason = 'Record block requires table_id'
        if (isDev) {
          console.warn(`[BlockGuard] Record block is missing table_id`)
        }
        return {
          valid: false,
          reason,
          missingFields,
          showSetupUI: true,
        }
      }
      if (!config.record_id && !pageRecordId) {
        missingFields.push('record_id')
        const reason = 'Record block requires record_id or pageRecordId'
        if (isDev) {
          console.warn(`[BlockGuard] Record block is missing record_id`)
        }
        return {
          valid: false,
          reason,
          missingFields,
          showSetupUI: true,
        }
      }
      break

    case 'form':
      // Form block MUST have table_id configured - no fallback
      if (!config.table_id && !pageTableId) {
        missingFields.push('table_id')
        const reason = 'Form block requires table_id'
        if (isDev) {
          console.warn(`[BlockGuard] Form block is missing table_id`)
        }
        return {
          valid: false,
          reason,
          missingFields,
          showSetupUI: true,
        }
      }
      break

    case 'text':
      // Text block can be empty (show setup UI)
      // But if it has content_json, validate it exists
      if (config.content_json === undefined && !config.content && !config.text_content) {
        // Empty text block - valid but show setup UI
        return {
          valid: true,
          showSetupUI: true,
        }
      }
      break

    case 'image':
      // Image blocks can be empty (show upload prompt)
      // Always valid
      return { valid: true }

    case 'filter':
    case 'divider':
      // These blocks don't require config
      return { valid: true }

    default:
      // Unknown block type - assume valid but log warning
      if (isDev) {
        console.warn(`[BlockGuard] Unknown block type: ${blockType}`)
      }
      return { valid: true }
  }

  return { valid: true }
}

/**
 * Check if block should show setup UI instead of rendering
 */
export function shouldShowBlockSetupUI(
  blockType: BlockType,
  config: BlockConfig | undefined | null,
  options?: {
    pageTableId?: string | null
    pageRecordId?: string | null
    hasDateField?: boolean
  }
): boolean {
  const validity = assertBlockConfig(blockType, config, options)
  return validity.showSetupUI === true || !validity.valid
}

/**
 * Validate block config and return safe config for rendering
 * Replaces silent fallbacks with explicit validation
 */
export function validateAndNormalizeBlockConfig(
  blockType: BlockType,
  config: BlockConfig | undefined | null,
  options?: {
    pageTableId?: string | null
    pageRecordId?: string | null
    hasDateField?: boolean
  }
): {
  config: BlockConfig
  isValid: boolean
  shouldShowSetup: boolean
  reason?: string
} {
  const validity = assertBlockConfig(blockType, config, options)
  
  // Return normalized config (empty if invalid)
  const safeConfig: BlockConfig = config && typeof config === 'object' ? config : {}

  return {
    config: safeConfig,
    isValid: validity.valid,
    shouldShowSetup: validity.showSetupUI === true || !validity.valid,
    reason: validity.reason,
  }
}

