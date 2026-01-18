/**
 * Discriminated Union Types for Block Configs
 * Each block type has its own config shape for better type safety
 */

import type { ViewType, ChartType, AggregateType } from './types'

// Base config shared by all blocks
interface BaseBlockConfig {
  title?: string
  appearance?: {
    title?: string
    title_color?: string
    text_color?: string
    background_color?: string
    border_color?: string
    border_width?: number
    border_radius?: number
    padding?: number
    show_title?: boolean
    header_background?: string
    header_text_color?: string
  }
  visibility_rules?: Array<{
    field?: string
    condition?: string
    value?: any
  }>
}

// Grid Block Config
export interface GridBlockConfig extends BaseBlockConfig {
  table_id?: string // Required - no fallback to page table
  view_id?: string // Optional - for view-specific settings
  view_type?: ViewType
  source_type?: 'table' | 'sql_view'
  source_view?: string
  group_by?: string
  fields?: string[] // Legacy - use visible_fields instead
  visible_fields?: string[] // Required - array of field names to display
  filters?: Array<{
    field: string
    operator: string
    value?: any
  }>
  sorts?: Array<{
    field: string
    direction: 'asc' | 'desc'
  }>
}

// Form Block Config
export interface FormBlockConfig extends BaseBlockConfig {
  table_id: string // Required for forms
  form_fields?: Array<{
    field_id: string
    field_name: string
    required: boolean
    visible: boolean
    order: number
  }>
  submit_action?: 'create' | 'update' | 'custom'
  appearance?: BaseBlockConfig['appearance'] & {
    form_layout?: 'single' | 'two'
    label_position?: 'top' | 'left' | 'inline'
    field_spacing?: number
    button_alignment?: 'left' | 'center' | 'right' | 'full'
  }
}

// Record Block Config
export interface RecordBlockConfig extends BaseBlockConfig {
  table_id: string // Required
  record_id?: string
  detail_fields?: string[]
  allow_editing?: boolean
}

// Chart Block Config
export interface ChartBlockConfig extends BaseBlockConfig {
  table_id: string // Required
  view_id?: string
  chart_type: ChartType // Required
  chart_x_axis?: string
  chart_y_axis?: string
  group_by_field?: string
  metric_field?: string
  appearance?: BaseBlockConfig['appearance'] & {
    show_legend?: boolean
    legend_position?: string
    color_scheme?: string
    show_grid?: boolean
  }
}

// KPI Block Config
export interface KPIBlockConfig extends BaseBlockConfig {
  table_id: string // Required
  view_id?: string
  kpi_field?: string
  kpi_aggregate: AggregateType // Required
  kpi_label?: string
  comparison?: {
    date_field: string
    current_start: string
    current_end: string
    previous_start: string
    previous_end: string
  }
  target_value?: number | string
  click_through?: {
    view_id?: string
  }
  appearance?: BaseBlockConfig['appearance'] & {
    number_format?: string
    show_trend?: boolean
    alignment?: string
    value_size?: string
  }
}

// Text Block Config
// CRITICAL: This is the contract for TextBlock
// - content: The text/markdown content to display (required for rendering)
// - markdown: Whether to render as markdown (default: true)
// - text_content: Legacy alias for content (for backward compatibility)
export interface TextBlockConfig extends BaseBlockConfig {
  // Primary content field - TipTap JSON format (preferred)
  content_json?: any
  // Plain text content - extracted from JSON for compatibility/search
  content?: string
  // Legacy alias - maps to content
  text_content?: string
  // Legacy text field
  text?: string
  // Whether to render markdown (deprecated - TipTap handles formatting natively)
  markdown?: boolean
  appearance?: BaseBlockConfig['appearance'] & {
    text_size?: 'sm' | 'md' | 'lg' | 'xl'
    text_align?: 'left' | 'center' | 'right' | 'justify'
  }
}

// Image Block Config
export interface ImageBlockConfig extends BaseBlockConfig {
  image_url: string // Required
  image_alt?: string
  appearance?: BaseBlockConfig['appearance'] & {
    image_size?: 'auto' | 'contain' | 'cover' | 'small' | 'medium' | 'large'
    image_align?: 'left' | 'center' | 'right'
    aspect_ratio?: 'auto' | '1:1' | '16:9' | '4:3' | '3:2'
    max_width?: number
  }
}

// Gallery Block Config (table-based, card/grid layout)
// Uses the same base config as Grid blocks, with view_type='gallery'
export interface GalleryBlockConfig extends GridBlockConfig {
  view_type?: 'gallery'
}

// Divider Block Config
export interface DividerBlockConfig extends BaseBlockConfig {
  appearance?: BaseBlockConfig['appearance'] & {
    divider_thickness?: number
    divider_color?: string
    divider_style?: 'solid' | 'dashed' | 'dotted'
    divider_spacing_top?: number
    divider_spacing_bottom?: number
  }
}

// Button Block Config
export interface ButtonBlockConfig extends BaseBlockConfig {
  button_label: string // Required
  button_automation_id?: string
}

// Action Block Config
export interface ActionBlockConfig extends BaseBlockConfig {
  action_type: 'navigate' | 'create_record' | 'redirect' // Required
  label: string // Required
  url?: string // Required for redirect
  route?: string // Required for navigate
  table_id?: string // Required for create_record
  confirmation_message?: string
  icon?: string
  appearance?: BaseBlockConfig['appearance'] & {
    button_background?: string
    button_text_color?: string
    button_style?: string
  }
}

// Link Preview Block Config
export interface LinkPreviewBlockConfig extends BaseBlockConfig {
  link_url: string // Required
  link_title?: string
  link_description?: string
  appearance?: BaseBlockConfig['appearance'] & {
    display_mode?: string
    show_provider?: boolean
    show_thumbnail?: boolean
  }
}

// Filter Block Config
export interface FilterBlockConfig extends BaseBlockConfig {
  table_id?: string // Optional - can use page table_id
  target_blocks?: 'all' | string[] // Which blocks to filter
  allowed_fields?: string[] // Empty array means all fields allowed
  allowed_operators?: string[] // Empty array means all operators allowed
  filters?: Array<{
    field: string
    operator: string
    value?: any
  }>
}

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

