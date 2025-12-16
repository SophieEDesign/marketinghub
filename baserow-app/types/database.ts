export type AccessControl = 'public' | 'authenticated' | 'role-based' | 'owner'

export type ViewType = 'grid' | 'form' | 'kanban' | 'calendar' | 'gallery' | 'page'

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

export type SortDirection = 'asc' | 'desc'

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
  table_id: string
  name: string
  type: ViewType
  config?: Record<string, any>
  access_level?: string
  allowed_roles?: string[]
  owner_id?: string
  public_share_id?: string
  created_at: string
  updated_at?: string
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
  field_id: string
  filter_type: FilterType
  value?: string
  created_at: string
}

export interface ViewSort {
  id: string
  view_id: string
  field_id: string
  order_direction: SortDirection
  order_index: number
  created_at: string
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
  table_id: string
  name: string
  description?: string
  trigger_type: string
  trigger_config?: Record<string, any>
  actions?: any[]
  enabled: boolean
  created_at: string
  updated_at: string
  created_by?: string
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
