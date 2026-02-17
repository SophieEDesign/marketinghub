/**
 * Page Configuration Types
 * All page behavior comes from config - no hardcoding
 */

import type { FilterTree } from '@/lib/filters/canonical-model'
import type { GroupRule } from '@/lib/grouping/types'

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
  
  // Record View specific (page-level settings)
  table_id?: string // Source table for Record View (page-level)
  visible_fields?: string[] // Fields visible in structured field list (page-level) - DEPRECATED: use field_layout
  editable_fields?: string[] // Fields that are editable (page-level, subset of visible_fields) - DEPRECATED: use field_layout
  show_field_list?: boolean // Toggle to show/hide structured field list (page-level)
  show_blocks_section?: boolean // Toggle to show/hide blocks section (page-level)
  show_field_names?: boolean // Toggle to show/hide field names on blocks (page-level; default true)
  title_size?: 'large' | 'extra_large' // Record detail title size (Airtable parity)
  comments_enabled?: boolean // Show record comments (default true)
  revision_history_enabled?: boolean // Show revision history (default false)
  show_as_full_width?: boolean // Expand record detail to full width on larger screens
  
  // Unified field layout configuration (replaces modal_fields, card_fields, visible_fields)
  field_layout?: Array<{
    field_id: string
    field_name: string
    order: number
    visible_in_modal?: boolean
    visible_in_card?: boolean
    visible_in_canvas?: boolean
    editable: boolean
    group_name?: string
    label_override?: string
    helper_text?: string
    field_size?: 'small' | 'medium' | 'large'
    visibility_rules?: Array<{ field: string; operator: string; value: unknown }>
  }>

  /**
   * Record actions permissions for record-based pages (record_view / record_review).
   * Controls who can create/delete records from record-page UI surfaces.
   *
   * Defaults (if omitted):
   * - create: 'both'
   * - delete: 'admin'
   */
  record_actions?: {
    create?: 'admin' | 'both'
    delete?: 'admin' | 'both'
  }
  
  // Left Panel (Record List) settings
  left_panel?: {
    // Data options
    filter_by?: Array<{ field: string; operator: string; value: any }>
    filter_tree?: FilterTree
    sort_by?: Array<{ field: string; direction: 'asc' | 'desc' }>
    group_by?: string // Field name to group by (legacy)
    group_by_rules?: GroupRule[] // Nested grouping rules (takes precedence over group_by)
    
    // List item display
    color_field?: string // Field name for color
    image_field?: string // Field name for image
    title_field?: string // Field name for title (in list item)
    field_1?: string // Field name for first additional field
    field_2?: string // Field name for second additional field
    
    // User actions (enabled/disabled)
    user_actions?: {
      sort?: boolean // Allow user to sort
      filter?: boolean // Allow user to filter
      group?: boolean // Allow user to group
      add_records?: boolean // Allow adding records through form
      buttons?: Array<{ label: string; action: string }> // Custom buttons
    }
  }
  
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
      group_by_field: '', // Select field to group records by in left panel
      // Record View page-level settings
      visible_fields: [],
      editable_fields: [],
      show_field_list: true,
      show_blocks_section: true,
      show_field_names: true,
    },
    record_view: {
      visualisation: 'record_view',
      allow_grid_toggle: false,
      record_panel: 'none', // Record View uses structured field list + blocks, not record panel
      allow_editing: true,
      // Record View page-level settings
      visible_fields: [],
      editable_fields: [],
      show_field_list: true,
      show_blocks_section: true,
      show_field_names: true,
    },
    blank: {
      visualisation: 'blank',
      allow_grid_toggle: false,
    },
  }

  return defaults[pageType] || {}
}

