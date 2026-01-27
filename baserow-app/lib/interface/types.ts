export type BlockType =
  | 'grid'
  | 'form'
  | 'record'
  | 'chart'
  | 'kpi'
  | 'text'
  | 'image'
  | 'gallery'
  | 'divider'
  | 'button'
  | 'action'
  | 'link_preview'
  | 'filter'
  | 'field'
  | 'field_section'
  | 'calendar'
  | 'multi_calendar'
  | 'kanban'
  | 'timeline'
  | 'multi_timeline'
  | 'list'
  | 'number'
  | 'horizontal_grouped'

export type ChartType = 'bar' | 'line' | 'pie' | 'area' | 'stacked_bar'
export type AggregateType = 'count' | 'sum' | 'avg' | 'min' | 'max'

export interface PageBlock {
  id: string
  page_id: string
  type: BlockType
  x: number
  y: number
  w: number
  h: number
  config: BlockConfig
  order_index: number
  created_at: string
  updated_at?: string
}

export type ViewType = 'grid' | 'kanban' | 'calendar' | 'gallery' | 'timeline' | 'form' | 'horizontal_grouped' | 'list'

export interface BlockConfig {
  title?: string
  table_id?: string
  view_id?: string
  view_type?: ViewType // View type for grid blocks (grid, kanban, calendar, gallery, timeline)
  record_id?: string
  fields?: string[]
  filters?: BlockFilter[]
  sorts?: BlockSort[]
  group_by?: string
  chart_type?: ChartType
  chart_x_axis?: string
  chart_y_axis?: string
  chart_aggregate?: AggregateType
  kpi_field?: string
  kpi_aggregate?: AggregateType
  kpi_label?: string
  text_content?: string
  image_url?: string
  image_alt?: string
  button_label?: string
  button_automation_id?: string
  visibility_rules?: VisibilityRule[]
  // Table snapshot
  row_limit?: number
  highlight_rules?: HighlightRule[]
  // Action block
  action_type?: 'navigate' | 'create_record' | 'redirect'
  label?: string
  url?: string
  route?: string
  confirmation_message?: string
  icon?: string
  // Link preview
  link_url?: string
  link_title?: string
  link_description?: string
  // Text block
  content?: string
  markdown?: boolean
  // KPI comparison
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
  // Chart
  group_by_field?: string
  metric_field?: string
  source_type?: 'table' | 'sql_view'
  source_view?: string
  // Form
  form_fields?: Array<{
    field_id: string
    field_name: string
    required: boolean
    visible: boolean
    order: number
  }>
  submit_action?: 'create' | 'update' | 'custom'
  detail_fields?: string[]
  allow_editing?: boolean
  // Filter block
  target_blocks?: 'all' | string[]
  // Field block
  field_id?: string
  allowed_fields?: string[]
  allowed_operators?: string[]
  allow_inline_edit?: boolean // Enable inline editing for field block
  inline_edit_permission?: 'admin' | 'member' | 'both' // Who can edit inline (default: 'both')
  // Block-level permissions
  permissions?: {
    mode?: 'view' | 'edit' // Access mode: view-only or editable
    allowInlineCreate?: boolean // Allow users to add records inline
    allowInlineDelete?: boolean // Allow users to delete records inline
    allowOpenRecord?: boolean // Allow users to open record details
  }
  // Record action permissions (create/delete)
  record_actions?: {
    create?: 'admin' | 'both' // Who can create records: 'admin' (admin only) or 'both' (admins + members)
    delete?: 'admin' | 'both' // Who can delete records: 'admin' (admin only) or 'both' (admins + members)
  }
  // Appearance settings
  appearance?: {
    // Airtable-style appearance (new)
    background?: 'none' | 'subtle' | 'tinted' | 'emphasised'
    border?: 'none' | 'outline' | 'card'
    radius?: 'square' | 'rounded'
    shadow?: 'none' | 'subtle' | 'card'
    padding?: 'compact' | 'normal' | 'spacious' | number // New style or legacy numeric
    margin?: 'none' | 'small' | 'normal' | 'large'
    accent?: 'none' | 'grey' | 'blue' | 'green' | 'yellow' | 'red' | 'purple'
    showTitle?: boolean
    titleSize?: 'small' | 'medium' | 'large'
    titleAlign?: 'left' | 'center'
    showDivider?: boolean
    // Legacy appearance (for backward compatibility)
    title?: string
    title_color?: string
    text_color?: string // General text color
    background_color?: string
    border_color?: string
    border_width?: number
    border_radius?: number
    show_title?: boolean
    header_background?: string
    header_text_color?: string
    // Action block specific
    button_background?: string
    button_text_color?: string
    button_style?: string
    // Chart block specific
    show_legend?: boolean
    legend_position?: string
    color_scheme?: string
    show_grid?: boolean
    // KPI block specific
    number_format?: string
    show_trend?: boolean
    alignment?: string
    value_size?: string
    // Table snapshot specific
    row_height?: string
    show_headers?: boolean
    // Grid block specific
    show_toolbar?: boolean
    show_search?: boolean
    show_filter?: boolean
    show_sort?: boolean
    wrap_text?: boolean // Whether to wrap cell text (block-level setting)
    // Data-view blocks (grid/calendar/kanban/timeline/gallery/list)
    show_add_record?: boolean // Show an "Add record" button inside the block
    // Record opening settings
    enable_record_open?: boolean // Enable/disable record opening (default: true)
    record_open_style?: 'side_panel' | 'modal' // How to open records (default: 'side_panel' for desktop)
    // Color and image fields for table/kanban/timeline/calendar blocks
    color_field?: string // Field name/ID to use for row/card colors (single-select field)
    image_field?: string // Field name/ID to use for row/card images
    fit_image_size?: boolean // Whether to fit image to container size
    // Text block specific
    text_size?: string
    text_align?: string
    font_weight?: 'normal' | 'medium' | 'semibold' | 'bold'
    // Link preview specific
    display_mode?: string
    show_provider?: boolean
    show_thumbnail?: boolean
    // Tabs specific
    tab_style?: 'default' | 'pills' | 'underline'
    tab_position?: 'top' | 'left' | 'right'
    tab_background?: string
    active_tab_color?: string
    content_padding?: number
    // Form specific
    form_layout?: 'single' | 'two'
    label_position?: 'top' | 'left' | 'inline'
    field_spacing?: number
    button_alignment?: 'left' | 'center' | 'right' | 'full'
    enable_modal_display?: boolean // Enable modal display for form/record blocks
    modal_style?: 'side_panel' | 'modal' // Modal display style (default: 'side_panel')
    // Image specific
    image_size?: 'auto' | 'contain' | 'cover' | 'small' | 'medium' | 'large'
    image_align?: 'left' | 'center' | 'right'
    aspect_ratio?: 'auto' | '1:1' | '16:9' | '4:3' | '3:2'
    max_width?: number
    // Divider specific
    divider_thickness?: number
    divider_color?: string
    divider_style?: 'solid' | 'dashed' | 'dotted'
    divider_height?: number
    divider_spacing_top?: number
    divider_spacing_bottom?: number
    // Timeline/Calendar view specific
    timeline_wrap_title?: boolean
    card_wrap_title?: boolean
    // List view specific
    list_title_field?: string // Required: field name for list item title
    list_subtitle_fields?: string[] // Optional: up to 3 subtitle fields
    list_image_field?: string // Optional: field name for image/attachment
    list_pill_fields?: string[] // Optional: select/multi-select fields to show as pills
    list_meta_fields?: string[] // Optional: date, number, etc. for metadata
    // Attachment/Image field display settings (for field blocks)
    attachment_display_style?: 'thumbnails' | 'list' | 'hero' | 'cover' | 'gallery' // Display style for attachments
    attachment_size?: 'small' | 'medium' | 'large' // Preview size for attachments (for thumbnails/list)
    attachment_max_visible?: number // Max number of previews to show before "+X more"
  }
  // List block specific config (at root level for backward compatibility)
  list_title_field?: string
  list_subtitle_fields?: string[]
  list_image_field?: string
  list_pill_fields?: string[]
  list_meta_fields?: string[]
  // List view grouping behavior (choice fields)
  list_choice_groups_default_collapsed?: boolean
  // Modal layout configuration
  modal_layout?: {
    blocks: Array<{
      id: string
      type: 'field' | 'text' | 'divider' | 'image'
      fieldName?: string // For field blocks
      x: number
      y: number
      w: number
      h: number
      config?: Record<string, any>
    }>
    layoutSettings?: {
      cols?: number
      rowHeight?: number
      margin?: [number, number]
    }
  }
  [key: string]: any
}

export interface BlockFilter {
  field: string
  operator: 'equal' | 'not_equal' | 'contains' | 'not_contains' | 'greater_than' | 'less_than' | 'is_empty' | 'is_not_empty'
  value: any
}

export interface BlockSort {
  field: string
  direction: 'asc' | 'desc'
}

export interface VisibilityRule {
  field?: string
  condition?: string
  value?: any
}

export interface HighlightRule {
  field: string
  operator: 'eq' | 'neq' | 'gt' | 'lt' | 'contains' | 'date_before' | 'date_after' | 'date_today' | 'date_overdue' | 'is_empty' | 'is_not_empty'
  value?: any
  background_color?: string
  text_color?: string
  scope?: 'cell' | 'row' | 'group' // Where the color applies: cell (specific field), row (entire row), or group (group header)
  target_field?: string // Optional field name for cell-level formatting (when scope is 'cell')
}

export interface Page {
  id: string
  name: string
  description?: string
  settings?: PageSettings
  created_at: string
  updated_at?: string
  created_by?: string
  is_admin_only?: boolean // If true, only admins can see this interface
}

export interface PageSettings {
  icon?: string
  access?: 'public' | 'authenticated' | 'roles'
  allowed_roles?: string[]
  primary_table_id?: string
  /**
   * Page-level default for showing an "Add record" button in data blocks.
   * Blocks can override via block.config.appearance.show_add_record:
   * - true: always show
   * - false: never show
   * - undefined: follow this page default
   */
  show_add_record?: boolean
  // Backward compatibility / convenience (camelCase)
  showAddRecord?: boolean
  layout?: {
    cols?: number
    rowHeight?: number
    margin?: [number, number]
  }
  // Record Review page settings
  tableId?: string // Required for record_review pages
  leftPanel?: {
    visibleFieldIds: string[] // Which fields show in left column
    fieldOrder: string[] // Order of fields (if empty, use table field order)
    showLabels?: boolean // Show field labels
    compact?: boolean // Compact display mode
  }
  // Backward compatibility: support snake_case format
  left_panel?: {
    visibleFieldIds: string[] // Which fields show in left column
    fieldOrder: string[] // Order of fields (if empty, use table field order)
    showLabels?: boolean // Show field labels
    compact?: boolean // Compact display mode
  }
}

export interface LayoutItem {
  i: string // block id
  x: number
  y: number
  w: number
  h: number
  minW?: number
  minH?: number
  maxW?: number
  maxH?: number
}
