export type AccessControl = 'public' | 'authenticated' | 'role-based' | 'owner'

export type ViewType = 'grid' | 'form' | 'kanban' | 'calendar' | 'timeline' | 'gallery' | 'page' | 'interface'

export type FilterType =
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
  | 'date_range'
  | 'date_today'
  | 'date_next_days'
  | 'has'
  | 'does_not_have'

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
  | 'automation'

export interface Table {
  id: string
  name: string
  supabase_table: string
  description?: string
  created_at: string
  updated_at?: string
  created_by?: string
  category?: string
  access_control?: AccessControl
}

export interface View {
  id: string
  table_id: string | null // null for interface views
  name: string
  type: ViewType
  config?: Record<string, any>
  access_level?: string
  allowed_roles?: string[]
  owner_id?: string
  public_share_id?: string
  created_at: string
  updated_at?: string
  group_id?: string | null // For interface grouping
  order_index?: number // For ordering within groups
  is_admin_only?: boolean // If true, only admins can see this interface
}

export interface ViewField {
  id: string
  view_id: string
  field_name: string
  visible: boolean
  position: number
  created_at?: string
}

export interface ViewFilter {
  id: string
  view_id: string
  field_name: string
  operator: FilterType
  value?: string
  filter_group_id?: string | null
  order_index?: number
  created_at?: string
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
  order_index?: number
  created_at?: string
}

export interface ViewBlock {
  id: string
  view_id: string
  type: BlockType
  position_x: number
  position_y: number
  width: number
  height: number
  config?: Record<string, any>
  order_index: number
  created_at: string
  updated_at: string
}

export interface Automation {
  id: string
  table_id?: string
  name: string
  description?: string
  trigger_type?: string
  trigger_config?: Record<string, any>
  actions?: any[]
  conditions?: any[]
  enabled: boolean
  category?: string
  tags?: string[]
  created_at?: string
  updated_at?: string
  created_by?: string
}

export interface AutomationRun {
  id: string
  automation_id: string
  status: 'running' | 'completed' | 'failed' | 'stopped'
  started_at: string
  completed_at?: string
  error?: string
  context?: Record<string, any>
  created_at?: string
}

export interface AutomationLog {
  id: string
  automation_id: string
  run_id?: string
  level: 'info' | 'warning' | 'error'
  message: string
  data?: Record<string, any>
  created_at: string
}

export interface Page {
  id: string
  name: string
  description?: string
  settings?: {
    access?: 'public' | 'authenticated' | 'roles'
    allowed_roles?: string[]
    layout?: {
      cols?: number
      rowHeight?: number
      margin?: [number, number]
    }
  }
  created_at: string
  updated_at?: string
  created_by?: string
}

export interface PageBlock {
  id: string
  page_id: string
  type: string
  x: number
  y: number
  w: number
  h: number
  config: Record<string, any>
  order_index: number
  created_at: string
  updated_at?: string
}

export interface TableRow {
  id: string
  table_id: string
  data: Record<string, any>
  created_at: string
  updated_at: string
  created_by?: string
  updated_by?: string
}

// Re-export field types for convenience
export type { FieldType, TableField, FieldOptions } from './fields'
