import type { Automation } from "@/types/database"
import type { TriggerType, ActionConfig } from "./types"

export interface AutomationTemplate {
  id: string
  name: string
  description: string
  category: string
  icon: string
  triggerType: TriggerType
  triggerConfig: any
  actions: ActionConfig[]
  conditions?: any[]
}

export const AUTOMATION_TEMPLATES: AutomationTemplate[] = [
  {
    id: 'email-on-create',
    name: 'Send email when record is created',
    description: 'Automatically send an email notification whenever a new record is added',
    category: 'Notifications',
    icon: '📧',
    triggerType: 'row_created',
    triggerConfig: {},
    actions: [
      {
        type: 'send_email',
        to: '{{email}}',
        subject: 'New record: {{name}}',
        email_body: 'A new record has been created:\n\n{{name}}\n\nView it in your workspace.',
      },
    ],
  },
  {
    id: 'update-related-record',
    name: 'Update related record when field changes',
    description: 'When a field changes in one record, automatically update a related record',
    category: 'Data Sync',
    icon: '🔄',
    triggerType: 'row_updated',
    triggerConfig: {
      watch_fields: ['status'],
    },
    actions: [
      {
        type: 'update_record',
        table_id: '',
        record_id: '{{related_record_id}}',
        field_update_mappings: [
          { field: 'status', value: '{{status}}' },
        ],
      },
    ],
  },
  {
    id: 'archive-old-records',
    name: 'Archive old records weekly',
    description: 'Automatically move or mark old records as archived on a schedule',
    category: 'Maintenance',
    icon: '📦',
    triggerType: 'schedule',
    triggerConfig: {
      interval: 'week',
      day_of_week: 0, // Sunday
      time: '02:00',
    },
    actions: [
      {
        type: 'update_record',
        table_id: '',
        record_id: '{{record_id}}',
        field_update_mappings: [
          { field: 'archived', value: 'true' },
          { field: 'archived_at', value: '{{NOW()}}' },
        ],
      },
    ],
    conditions: [
      {
        filter_tree: {
          operator: 'AND',
          children: [
            {
              field_id: 'created_at',
              operator: 'date_before',
              value: { days: 90 },
            },
            {
              field_id: 'archived',
              operator: 'equal',
              value: false,
            },
          ],
        },
      },
    ],
  },
  {
    id: 'notify-status-change',
    name: 'Notify team on status change',
    description: 'Send a notification when a record\'s status field changes to a specific value',
    category: 'Notifications',
    icon: '🔔',
    triggerType: 'row_updated',
    triggerConfig: {
      watch_fields: ['status'],
    },
    actions: [
      {
        type: 'send_email',
        to: 'team@example.com',
        subject: 'Status changed: {{name}}',
        email_body: 'The status of "{{name}}" has changed to {{status}}.',
      },
    ],
    conditions: [
      {
        filter_tree: {
          operator: 'AND',
          children: [
            {
              field_id: 'status',
              operator: 'equal',
              value: 'completed',
            },
          ],
        },
      },
    ],
  },
  {
    id: 'sync-between-tables',
    name: 'Sync data between tables',
    description: 'Keep data synchronized between two related tables',
    category: 'Data Sync',
    icon: '🔗',
    triggerType: 'row_updated',
    triggerConfig: {},
    actions: [
      {
        type: 'update_record',
        table_id: '',
        record_id: '{{linked_record_id}}',
        field_update_mappings: [
          { field: 'name', value: '{{name}}' },
          { field: 'updated_at', value: '{{NOW()}}' },
        ],
      },
    ],
  },
  {
    id: 'create-follow-up-task',
    name: 'Create follow-up task after deadline',
    description: 'Automatically create a follow-up task when a record passes its deadline',
    category: 'Workflow',
    icon: '✅',
    triggerType: 'condition',
    triggerConfig: {
      check_interval: 3600, // Check every hour
      formula: '{deadline} < NOW() AND {status} != "completed"',
    },
    actions: [
      {
        type: 'create_record',
        table_id: '',
        field_update_mappings: [
          { field: 'title', value: 'Follow-up: {{name}}' },
          { field: 'related_record_id', value: '{{record_id}}' },
          { field: 'due_date', value: '{{NOW()}}' },
          { field: 'priority', value: 'high' },
        ],
      },
    ],
  },
]

export function getTemplatesByCategory() {
  const categories: Record<string, AutomationTemplate[]> = {}
  AUTOMATION_TEMPLATES.forEach((template) => {
    if (!categories[template.category]) {
      categories[template.category] = []
    }
    categories[template.category].push(template)
  })
  return categories
}
