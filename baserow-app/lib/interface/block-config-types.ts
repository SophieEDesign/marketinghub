/**
 * Discriminated Union Types for Block Configs
 * Each block type has its own config shape for better type safety
 * 
 * NOTE: These types extend the base BlockConfig from types.ts to provide
 * type narrowing and validation, while avoiding duplication.
 */

import type { BlockConfig, ViewType, ChartType, AggregateType } from './types'

// Base config shared by all blocks - extends BlockConfig to avoid duplication
// Specific block configs add required fields and constraints
type BaseBlockConfig = BlockConfig

// Grid Block Config
// Extends BlockConfig with grid-specific constraints
export interface GridBlockConfig extends BaseBlockConfig {
  // Grid-specific: table_id or source_view required
  table_id?: string
  source_view?: string
  view_type?: ViewType
  // Note: filters, sorts, group_by, visible_fields are already in BlockConfig
}

// Form Block Config
export interface FormBlockConfig extends BaseBlockConfig {
  table_id: string // Required for forms
  // Note: form_fields, submit_action are already in BlockConfig
}

// Record Block Config
export interface RecordBlockConfig extends BaseBlockConfig {
  table_id: string // Required
  // Note: record_id, detail_fields, allow_editing are already in BlockConfig
}

// Chart Block Config
export interface ChartBlockConfig extends BaseBlockConfig {
  table_id: string // Required
  chart_type: ChartType // Required
  // Note: chart_x_axis, chart_y_axis, group_by_field, metric_field are already in BlockConfig
}

// KPI Block Config
export interface KPIBlockConfig extends BaseBlockConfig {
  table_id: string // Required
  kpi_aggregate: AggregateType // Required
  // Note: kpi_field, kpi_label, comparison, target_value, click_through are already in BlockConfig
}

// Text Block Config
// CRITICAL: This is the contract for TextBlock
// Note: content, text_content, markdown are already in BlockConfig
export type TextBlockConfig = BaseBlockConfig

// Image Block Config
export interface ImageBlockConfig extends BaseBlockConfig {
  image_url: string // Required (but can be empty for upload prompt)
  // Note: image_alt is already in BlockConfig
}

/**
 * Gallery Block Config (table-based, card/grid layout).
 * Used by GalleryView. Card content comes from visible_fields (first = title, next 3 = secondary);
 * optional overrides: gallery_title_field, card_title_field, title_field.
 * Grouping: group_by_rules, group_by_field, group_by, gallery_group_by.
 * Behavior: gallery_groups_default_collapsed (or grid_groups_default_collapsed).
 */
export interface GalleryBlockConfig extends GridBlockConfig {
  view_type?: 'gallery'
}

// Divider Block Config
// Note: divider appearance settings are already in BlockConfig.appearance
export type DividerBlockConfig = BaseBlockConfig

// Button Block Config
export interface ButtonBlockConfig extends BaseBlockConfig {
  button_label: string // Required
  // Note: button_automation_id is already in BlockConfig
}

// Action Block Config
export interface ActionBlockConfig extends BaseBlockConfig {
  action_type: 'navigate' | 'create_record' | 'redirect' // Required
  label: string // Required
  // Note: url, route, table_id, confirmation_message, icon are already in BlockConfig
}

// Link Preview Block Config
export interface LinkPreviewBlockConfig extends BaseBlockConfig {
  link_url: string // Required
  // Note: link_title, link_description are already in BlockConfig
}

// Filter Block Config
// Note: table_id, target_blocks, allowed_fields, allowed_operators, filters are already in BlockConfig
export type FilterBlockConfig = BaseBlockConfig

/**
 * Discriminated Union of all block configs
 * Use this with block.type to get proper type narrowing
 */
export type BlockConfigUnion =
  | (GridBlockConfig & { _type: 'grid' })
  | (FormBlockConfig & { _type: 'form' })
  | (RecordBlockConfig & { _type: 'record' })
  | (ChartBlockConfig & { _type: 'chart' })
  | (KPIBlockConfig & { _type: 'kpi' })
  | (TextBlockConfig & { _type: 'text' })
  | (ImageBlockConfig & { _type: 'image' })
  | (GalleryBlockConfig & { _type: 'gallery' })
  | (DividerBlockConfig & { _type: 'divider' })
  | (ButtonBlockConfig & { _type: 'button' })
  | (ActionBlockConfig & { _type: 'action' })
  | (LinkPreviewBlockConfig & { _type: 'link_preview' })
  | (FilterBlockConfig & { _type: 'filter' })

/**
 * Type guard functions for runtime validation
 */
export function isGridBlockConfig(config: any): config is GridBlockConfig {
  return config && (config.table_id !== undefined || config.source_view !== undefined)
}

export function isFormBlockConfig(config: any): config is FormBlockConfig {
  return config && typeof config.table_id === 'string'
}

export function isChartBlockConfig(config: any): config is ChartBlockConfig {
  return config && typeof config.table_id === 'string' && config.chart_type !== undefined
}

export function isKPIBlockConfig(config: any): config is KPIBlockConfig {
  return config && typeof config.table_id === 'string' && config.kpi_aggregate !== undefined
}

export function isImageBlockConfig(config: any): config is ImageBlockConfig {
  // Image blocks can be empty (no image_url) - they'll show upload prompt
  // Config is valid if it exists and image_url (if present) is a string
  return config && (config.image_url === undefined || typeof config.image_url === 'string')
}

export function isActionBlockConfig(config: any): config is ActionBlockConfig {
  return config && config.action_type !== undefined && typeof config.label === 'string'
}

export function isTextBlockConfig(config: any): config is TextBlockConfig {
  // Text block is valid if it exists (no required fields)
  // But for meaningful rendering, content should be present
  return config !== null && config !== undefined && typeof config === 'object'
}

export function isFilterBlockConfig(config: any): config is FilterBlockConfig {
  // Filter block has no required fields - it can start empty
  return config !== null && config !== undefined && typeof config === 'object'
}

/**
 * Validate block config based on block type
 * Returns validation errors if config is invalid
 */
export function validateBlockConfig(
  blockType: string,
  config: any
): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  // Helpers for backward compatibility with legacy/camelCase config shapes.
  const resolveLegacyTableId = (cfg: any) => cfg?.table_id || cfg?.tableId || cfg?.base_table || cfg?.baseTable
  const normalizeMultiSource = (s: any) => {
    if (!s || typeof s !== 'object') return {}
    return {
      ...s,
      table_id: s.table_id ?? s.tableId ?? s.table ?? '',
      view_id: s.view_id ?? s.viewId,
      title_field: s.title_field ?? s.titleField ?? s.title ?? '',
      start_date_field: s.start_date_field ?? s.startDateField ?? s.start_date ?? '',
      end_date_field: s.end_date_field ?? s.endDateField ?? s.end_date,
      color_field: s.color_field ?? s.colorField,
      type_field: s.type_field ?? s.typeField,
      enabled: s.enabled,
    }
  }

  switch (blockType) {
    case 'grid':
      // Grid can use either table_id or source_view
      if (!resolveLegacyTableId(config) && !config.source_view) {
        errors.push('Grid block requires either table_id or source_view')
      }
      break

    case 'form':
      if (!resolveLegacyTableId(config)) {
        errors.push('Form block requires table_id')
      }
      break

    case 'record':
      if (!resolveLegacyTableId(config)) {
        errors.push('Record block requires table_id')
      }
      break

    case 'chart':
      if (!resolveLegacyTableId(config)) {
        errors.push('Chart block requires table_id')
      }
      if (!config.chart_type) {
        errors.push('Chart block requires chart_type')
      }
      break

    case 'kpi':
      if (!resolveLegacyTableId(config)) {
        errors.push('KPI block requires table_id')
      }
      if (!config.kpi_aggregate) {
        errors.push('KPI block requires kpi_aggregate')
      }
      break

    case 'image':
      // Image blocks can be empty (no image_url) - they'll show upload prompt
      // Only validate if image_url is provided (must be a valid string)
      if (config.image_url && typeof config.image_url !== 'string') {
        errors.push('Image block image_url must be a string')
      }
      break

    case 'action':
      if (!config.action_type) {
        errors.push('Action block requires action_type')
      }
      if (!config.label) {
        errors.push('Action block requires label')
      }
      if (config.action_type === 'redirect' && !config.url) {
        errors.push('Redirect action requires url')
      }
      if (config.action_type === 'navigate' && !config.route) {
        errors.push('Navigate action requires route')
      }
      if (config.action_type === 'create_record' && !config.table_id) {
        errors.push('Create record action requires table_id')
      }
      break

    case 'text':
      // Text block has no required fields - it can render empty
      // But warn if content is missing (block will be empty)
      if (!config.content && !config.text_content) {
        // Not an error - text blocks can start empty
        // But we'll note it for completeness
      }
      break

    case 'filter':
      // Filter block has no required fields - it can start empty
      // Filters can be added dynamically
      break

    case 'calendar':
    case 'kanban':
    case 'gallery':
    case 'timeline':
    case 'list':
      // These blocks are wrappers around GridBlock, so they need table_id
      if (!resolveLegacyTableId(config)) {
        errors.push(`${blockType} block requires table_id`)
      }
      break

    case 'multi_calendar':
    case 'multi_timeline': {
      const sources = Array.isArray(config.sources) ? config.sources.map(normalizeMultiSource) : []
      if (sources.length === 0) {
        errors.push(`${blockType} block requires at least one source table`)
        break
      }
      sources.forEach((s: any, idx: number) => {
        // If the user disables a source, don't require it to be fully configured.
        if (s?.enabled === false) return

        if (!s?.table_id) errors.push(`Source ${idx + 1}: table_id is required`)
        if (!s?.title_field) errors.push(`Source ${idx + 1}: title_field is required`)
        if (!s?.start_date_field) errors.push(`Source ${idx + 1}: start_date_field is required`)
      })
      break
    }

    case 'number':
      // Number block requires table_id and field_id
      if (!resolveLegacyTableId(config)) {
        errors.push('Number block requires table_id')
      }
      if (!config.field_id) {
        errors.push('Number block requires field_id')
      }
      break

    case 'field':
      // Field block requires field_id
      if (!config.field_id) {
        errors.push('Field block requires field_id')
      }
      break

    // divider, button, link_preview have no required fields
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

