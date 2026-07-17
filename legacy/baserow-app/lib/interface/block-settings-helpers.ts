/**
 * Block settings helpers — single place for "which settings apply" per block type.
 * Uses the registry's applicableSettings and excludedSettings so block settings
 * logic comes from one place. Additive only; does not change existing behaviour.
 */

import type { BlockType } from './types'
import { getBlockDefinition } from './registry'

export interface EffectiveBlockSettings {
  /** Whether to show the Data settings tab/section for this block type */
  showDataSettings: boolean
  /** Whether to show the Appearance settings tab/section for this block type */
  showAppearanceSettings: boolean
  /** Granular flags from registry (for future use). Undefined means "not restricted". */
  applicableSettings?: {
    fields?: boolean
    filters?: boolean
    sorts?: boolean
    grouping?: boolean
    appearance?: boolean
    permissions?: boolean
    conditionalFormatting?: boolean
  }
}

const DEFAULT_APPLICABLE = {
  fields: true,
  filters: true,
  sorts: true,
  grouping: true,
  appearance: true,
  permissions: true,
  conditionalFormatting: true,
} as const

/**
 * Returns which settings apply for the given block type (and optional config).
 * Used by SettingsPanel / blockSettingsRegistry to decide which tabs/sections to show.
 *
 * Behaviour-preserving: showDataSettings and showAppearanceSettings default to true
 * so that existing UI (which shows both tabs for all block types) is unchanged.
 * Granular applicableSettings reflect the registry for future use.
 */
export function getEffectiveBlockSettings(
  blockType: BlockType,
  _config?: Record<string, unknown>
): EffectiveBlockSettings {
  const def = getBlockDefinition(blockType)
  const applicable = def.applicableSettings ?? DEFAULT_APPLICABLE
  const excluded = new Set(def.excludedSettings ?? [])

  const appearanceAllowed =
    (applicable.appearance ?? true) && !excluded.has('appearance')
  const hasAnyDataSetting =
    (applicable.fields ?? true) ||
    (applicable.filters ?? true) ||
    (applicable.sorts ?? true) ||
    (applicable.grouping ?? true) ||
    (applicable.permissions ?? true) ||
    (applicable.conditionalFormatting ?? true)

  return {
    showDataSettings: (hasAnyDataSetting && !excluded.has('data')) ?? true,
    showAppearanceSettings: appearanceAllowed,
    applicableSettings: { ...applicable },
  }
}

/**
 * Returns whether the Data settings tab should be shown for this block type.
 */
export function shouldShowDataSettings(blockType: BlockType): boolean {
  return getEffectiveBlockSettings(blockType).showDataSettings
}

/**
 * Returns whether the Appearance settings tab should be shown for this block type.
 */
export function shouldShowAppearanceSettings(blockType: BlockType): boolean {
  return getEffectiveBlockSettings(blockType).showAppearanceSettings
}
