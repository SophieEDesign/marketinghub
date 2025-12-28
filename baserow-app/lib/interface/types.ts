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

export type ChartType = 'bar' | 'line' | 'pie' | 'area'
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
  // Appearance settings
  appearance?: {
    title?: string
    title_color?: string
    background_color?: string
    border_color?: string
    border_width?: number
    border_radius?: number
    padding?: number
    show_title?: boolean
    header_background?: string
    header_text_color?: string
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
