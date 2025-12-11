import { Automation } from "@/lib/types/automations";
import { AutomationTrigger, Condition, AutomationAction } from "@/lib/automations/schema";

export interface AutomationTemplate {
  id: string;
  name: string;
  description: string;
  category: "Notifications" | "Productivity" | "Reporting" | "Workflow";
  trigger: AutomationTrigger;
  conditions?: Condition[];
  actions: AutomationAction[];
  status?: "active" | "paused";
}

export const automationTemplates: AutomationTemplate[] = [
  {
    id: "daily-kpi-email",
    name: "Daily KPI Summary",
    description: "Email KPIs every morning at 9am",
    category: "Reporting",
    trigger: {
      type: "schedule",
      schedule: {
        frequency: "daily",
        time: "09:00",
      },
    },
    conditions: [],
    actions: [
      {
        type: "send_email",
        to: "{{admin_email}}",
        subject: "Daily KPI Summary - {{date}}",
        body: "Here are today's KPIs:\n\n- Total Records: {{total_records}}\n- New Records Today: {{new_records}}\n- Completed Tasks: {{completed_tasks}}\n\nView full dashboard: {{dashboard_url}}",
        from: "",
      },
    ],
    status: "active",
  },
  {
    id: "new-lead-notification",
    name: "New Lead Notification",
    description: "Send Slack notification when a new lead is created",
    category: "Notifications",
    trigger: {
      type: "record_created",
      table_id: "",
      table_name: "",
    },
    conditions: [],
    actions: [
      {
        type: "send_webhook",
        url: "{{slack_webhook_url}}",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: {
          text: "🎉 New lead created: {{record.name}}",
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: "*New Lead Created*\n*Name:* {{record.name}}\n*Email:* {{record.email}}\n*Company:* {{record.company}}",
              },
            },
          ],
        },
      },
    ],
    status: "active",
  },
  {
    id: "task-overdue-alert",
    name: "Task Overdue Alert",
    description: "Alert when a task is approaching its due date",
    category: "Notifications",
    trigger: {
      type: "date_approaching",
      table_id: "",
      table_name: "",
      date_field_key: "due_date",
      days_before: 1,
    },
    conditions: [
      {
        type: "field",
        field_key: "status",
        operator: "not_equals",
        value: "completed",
      },
    ],
    actions: [
      {
        type: "send_email",
        to: "{{record.assigned_to}}",
        subject: "Task Due Soon: {{record.title}}",
        body: "Hi,\n\nYour task '{{record.title}}' is due tomorrow.\n\nPlease review and complete it.\n\nView task: {{task_url}}",
        from: "",
      },
    ],
    status: "active",
  },
  {
    id: "auto-update-status",
    name: "Auto-Update Record Status",
    description: "Automatically update record when status field changes",
    category: "Workflow",
    trigger: {
      type: "record_updated",
      table_id: "",
      table_name: "",
      fields: ["status"],
    },
    conditions: [
      {
        type: "field",
        field_key: "status",
        operator: "equals",
        value: "completed",
      },
    ],
    actions: [
      {
        type: "update_record",
        table_id: "{{trigger.table_id}}",
        table_name: "{{trigger.table_name}}",
        record_id: "{{record.id}}",
        field_updates: {
          completed_at: "{{now}}",
          updated_by: "automation",
        },
      },
    ],
    status: "active",
  },
  {
    id: "weekly-digest-webhook",
    name: "Weekly Digest Webhook",
    description: "Send weekly summary via webhook every Monday at 8am",
    category: "Reporting",
    trigger: {
      type: "schedule",
      schedule: {
        frequency: "weekly",
        time: "08:00",
        dayOfWeek: 1, // Monday
      },
    },
    conditions: [],
    actions: [
      {
        type: "send_webhook",
        url: "{{webhook_url}}",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: {
          type: "weekly_digest",
          week_start: "{{week_start_date}}",
          week_end: "{{week_end_date}}",
          summary: {
            total_records: "{{total_records}}",
            new_records: "{{new_records_this_week}}",
            completed_tasks: "{{completed_tasks_this_week}}",
          },
        },
      },
    ],
    status: "active",
  },
];

export function getTemplatesByCategory() {
  const categories: Record<string, AutomationTemplate[]> = {};
  automationTemplates.forEach((template) => {
    if (!categories[template.category]) {
      categories[template.category] = [];
    }
    categories[template.category].push(template);
  });
  return categories;
}
