/**
 * Page Configuration Types
 * All page behavior comes from config - no hardcoding
 */

export interface PageConfig {
  // Visualization settings
  visualisation?: string // Override page_type visualization
  group_by?: string
  card_fields?: string[]
  cover_field?: string
  title_field?: string
  start_date?: string
  end_date?: string
  
  // Filtering and sorting
  default_filters?: Record<string, any>
  default_sorts?: Array<{ field: string; direction: 'asc' | 'desc' }>
  
  // UI behavior
  allow_grid_toggle?: boolean
  record_panel?: 'side' | 'bottom' | 'none'
  visible_columns?: string[]
  
  // Calendar/Timeline specific
  start_date_field?: string
  end_date_field?: string
  
  // Timeline specific
  group_by_field?: string
  
  // Dashboard specific
  aggregation_views?: string[] // SQL view names for metrics
  
  // Form specific
  form_fields?: string[]
  submit_action?: string
  
  // Record review specific
  detail_fields?: string[]
  preview_fields?: string[] // Fields to show in the left preview panel
  allow_editing?: boolean
  panel_layout?: Array<{
    id: string
    type: 'field' | 'block'
    fieldName?: string
    blockType?: string
    blockConfig?: any
  }> // Layout for record detail panel (fields and blocks)
  
  // General
  [key: string]: any
}

/**
 * Get default config for a page type
 */
export function getDefaultPageConfig(pageType: string): PageConfig {
  const defaults: Record<string, PageConfig> = {
    list: {
      visualisation: 'list',
      allow_grid_toggle: true,
      visible_columns: [],
    },
    gallery: {
      visualisation: 'gallery',
      allow_grid_toggle: true,
      cover_field: '',
      title_field: '',
    },
    kanban: {
      visualisation: 'kanban',
      allow_grid_toggle: true,
      group_by: '',
      card_fields: [],
    },
    calendar: {
      visualisation: 'calendar',
      allow_grid_toggle: true,
      start_date_field: '',
      end_date_field: '',
    },
    timeline: {
      visualisation: 'timeline',
      allow_grid_toggle: true,
      group_by_field: '',
      start_date_field: '',
      end_date_field: '',
    },
    form: {
      visualisation: 'form',
      form_fields: [],
      submit_action: 'create',
    },
    dashboard: {
      visualisation: 'dashboard',
      allow_grid_toggle: false,
      aggregation_views: [],
    },
    overview: {
      visualisation: 'overview',
      allow_grid_toggle: false,
    },
    record_review: {
      visualisation: 'record_review',
      allow_grid_toggle: true,
      record_panel: 'side',
      allow_editing: false,
      detail_fields: [],
      preview_fields: [], // Default: empty array means use name/status fields
    },
    blank: {
      visualisation: 'blank',
      allow_grid_toggle: false,
    },
  }

  return defaults[pageType] || {}
}

