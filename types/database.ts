export type AccessLevel = 'public' | 'authenticated' | 'owner'

export type ViewType = 'grid' | 'form' | 'kanban' | 'calendar' | 'gallery' | 'page' | 'interface'

export type FilterOperator =
  | 'equal'
  | 'not_equal'
  | 'contains'
  | 'not_contains'
  | 'is_empty'
  | 'is_not_empty'
  | 'greater_than'
  | 'less_than'
  | 'greater_than_or_equal'
  | 'less_than_or_equal'
  | 'date_equal'
  | 'date_before'
  | 'date_after'
  | 'date_on_or_before'
  | 'date_on_or_after'

export type SortDirection = 'asc' | 'desc'

export type FilterConditionType = 'AND' | 'OR'

export type BlockType =
  | 'text'
  | 'image'
  | 'chart'
  | 'kpi'
  | 'html'
  | 'embed'
  | 'table'
  | 'stat'
  | 'divider'

export interface Table {
  id: string
  name: string
  supabase_table: string
}

export interface View {
  id: string
  table_id: string | null // null for interface views
  name: string
  type: ViewType
  config?: Record<string, any>
  access_level: AccessLevel
  allowed_roles?: string[]
  owner_id?: string
  public_share_id?: string
}

export interface ViewField {
  id: string
  view_id: string
  field_name: string
  visible: boolean
  position: number
}

export interface ViewFilter {
  id: string
  view_id: string
  field_name: string
  operator: FilterOperator
  value?: string
  filter_group_id?: string | null
  order_index?: number
}

export interface ViewFilterGroup {
  id: string
  view_id: string
  condition_type: FilterConditionType
  order_index: number
  created_at?: string
  updated_at?: string
  created_by?: string
  updated_by?: string
}

export interface ViewSort {
  id: string
  view_id: string
  field_name: string
  direction: SortDirection
}

export interface ViewBlock {
  id: string
  view_id: string
  type: BlockType
  position: { x: number; y: number; w: number; h: number }
  settings?: Record<string, any>
  visibility?: string | boolean
}

export interface ViewTab {
  id: string
  view_id: string
  name: string
  position: number
}

export interface Automation {
  id: string
  name: string
  description?: string
  trigger?: Record<string, any>
  actions?: any[]
  conditions?: any[]
  enabled: boolean
}

export interface AutomationRun {
  id: string
  automation_id: string
  status: 'running' | 'completed' | 'failed'
  started_at: string
  completed_at?: string
  error?: string
}

export interface AutomationLog {
  id: string
  automation_id: string
  run_id?: string
  level: 'info' | 'warning' | 'error'
  message: string
  created_at: string
}
