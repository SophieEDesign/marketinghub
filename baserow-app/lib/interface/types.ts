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

export interface BlockConfig {
  title?: string
  table_id?: string
  view_id?: string
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
}

export interface PageSettings {
  access?: 'public' | 'authenticated' | 'roles'
  allowed_roles?: string[]
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
