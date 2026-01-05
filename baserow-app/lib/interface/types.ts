export type BlockType =
  | 'grid'
  | 'form'
  | 'record'
  | 'chart'
  | 'kpi'
  | 'text'
  | 'image'
  | 'divider'
  | 'button'
  | 'tabs'
  | 'table_snapshot'
  | 'action'
  | 'link_preview'

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

export type ViewType = 'grid' | 'kanban' | 'calendar' | 'gallery' | 'timeline' | 'form'

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
  action_type?: 'navigate' | 'create_record'
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
  // Tabs
  tabs?: Array<{
    id: string
    label: string
    block_ids: string[]
  }>
  default_tab_id?: string
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
  // Appearance settings
  appearance?: {
    title?: string
    title_color?: string
    text_color?: string // General text color
    background_color?: string
    border_color?: string
    border_width?: number
    border_radius?: number
    padding?: number
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
    // Text block specific
    text_size?: string
    text_align?: string
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
    // Image specific
    image_size?: 'auto' | 'contain' | 'cover' | 'small' | 'medium' | 'large'
    image_align?: 'left' | 'center' | 'right'
    aspect_ratio?: 'auto' | '1:1' | '16:9' | '4:3' | '3:2'
    max_width?: number
    // Divider specific
    divider_thickness?: number
    divider_color?: string
    divider_style?: 'solid' | 'dashed' | 'dotted'
    divider_spacing_top?: number
    divider_spacing_bottom?: number
  }
  [key: string]: any
}

export interface BlockFilter {
  field: string
  operator: 'equal' | 'not_equal' | 'contains' | 'greater_than' | 'less_than' | 'is_empty' | 'is_not_empty'
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
  operator: 'eq' | 'neq' | 'gt' | 'lt' | 'contains'
  value: any
  background_color?: string
  text_color?: string
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
  layout?: {
    cols?: number
    rowHeight?: number
    margin?: [number, number]
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
