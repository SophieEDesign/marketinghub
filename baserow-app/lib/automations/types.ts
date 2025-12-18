export type TriggerType =
  | 'row_created'
  | 'row_updated'
  | 'row_deleted'
  | 'schedule'
  | 'webhook'
  | 'condition'

export type ActionType =
  | 'update_record'
  | 'create_record'
  | 'delete_record'
  | 'send_email'
  | 'call_webhook'
  | 'run_script'
  | 'delay'
  | 'log_message'
  | 'stop_execution'

export type AutomationRunStatus = 'running' | 'completed' | 'failed' | 'stopped'
export type LogLevel = 'info' | 'warning' | 'error'

export interface TriggerConfig {
  // For row_created, row_updated, row_deleted
  table_id?: string
  
  // For row_updated
  watch_fields?: string[]
  
  // For schedule
  interval?: 'minute' | 'hour' | 'day' | 'week' | 'month'
  interval_value?: number
  time?: string // HH:MM format
  day_of_week?: number // 0-6 (Sunday-Saturday)
  day_of_month?: number // 1-31
  
  // For webhook
  webhook_id?: string
  
  // For condition
  formula?: string
  check_interval?: number // seconds
}

export interface ActionConfig {
  type: ActionType
  
  // For update_record, create_record, delete_record
  table_id?: string
  record_id?: string
  field_updates?: Record<string, any>
  
  // For send_email
  to?: string
  subject?: string
  email_body?: string
  
  // For call_webhook
  url?: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  headers?: Record<string, string>
  webhook_body?: any
  
  // For run_script
  script?: string
  
  // For delay
  delay_type?: 'seconds' | 'minutes' | 'hours' | 'until'
  delay_value?: number
  until_datetime?: string
  
  // For log_message
  message?: string
  level?: LogLevel
}

export interface AutomationContext {
  automation_id: string
  trigger_type: TriggerType
  trigger_data?: Record<string, any> // Row data, webhook payload, etc.
  table_id?: string
  record_id?: string
  variables?: Record<string, any>
}

export interface AutomationRun {
  id: string
  automation_id: string
  status: AutomationRunStatus
  started_at: string
  completed_at?: string
  error?: string
  context?: AutomationContext
}

export interface AutomationLog {
  id: string
  automation_id: string
  run_id?: string
  level: LogLevel
  message: string
  data?: Record<string, any>
  created_at: string
}
