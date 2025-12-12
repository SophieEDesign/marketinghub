/**
 * Page Actions System
 * Type definitions and execution engine for page-level actions
 */

export type PageActionType =
  | "update_record"
  | "create_record"
  | "delete_record"
  | "duplicate_record"
  | "navigate_to_page"
  | "open_record"
  | "send_email"
  | "webhook"
  | "run_automation"
  | "open_url"
  | "set_field_value"
  | "copy_to_clipboard";

export interface PageActionCondition {
  field: string;
  operator: "equals" | "not_equals" | "contains" | "greater_than" | "less_than" | "is_empty" | "is_not_empty";
  value?: any;
}

export interface PageAction {
  id: string;
  type: PageActionType;
  label: string;
  icon?: string;
  table?: string;
  recordIdField?: string;
  updates?: Record<string, any>;
  condition?: PageActionCondition;
  // Navigation
  pageId?: string;
  url?: string;
  // Record operations
  recordId?: string;
  // Automation
  automationId?: string;
  // Webhook
  webhookUrl?: string;
  webhookMethod?: "GET" | "POST" | "PUT" | "DELETE";
  webhookBody?: Record<string, any>;
  // Email
  emailTo?: string;
  emailSubject?: string;
  emailBody?: string;
  // Field value
  fieldKey?: string;
  fieldValue?: any;
  // Confirmation
  requiresConfirmation?: boolean;
  confirmationMessage?: string;
  // Visibility
  scope?: "page" | "record"; // page = top-level button, record = row/card menu
}

export interface QuickAutomation {
  id: string;
  label: string;
  trigger: {
    type: "record_created" | "record_updated" | "field_match" | "manual";
    conditions?: PageActionCondition[];
  };
  actions: PageAction[];
}

export interface ActionContext {
  record?: Record<string, any>;
  pageId?: string;
  router?: any; // Next.js router
  onRecordUpdate?: (recordId: string, updates: Record<string, any>) => Promise<void>;
  onNavigate?: (path: string) => void;
  onCopyToClipboard?: (text: string) => Promise<void>;
}

/**
 * Evaluate action condition
 */
export function evaluateActionCondition(
  condition: PageActionCondition | undefined,
  record: Record<string, any>
): boolean {
  if (!condition) return true;

  const fieldValue = record[condition.field];
  const { operator, value } = condition;

  switch (operator) {
    case "equals":
      return fieldValue === value;
    case "not_equals":
      return fieldValue !== value;
    case "contains":
      return String(fieldValue || "").includes(String(value || ""));
    case "greater_than":
      return Number(fieldValue) > Number(value);
    case "less_than":
      return Number(fieldValue) < Number(value);
    case "is_empty":
      return !fieldValue || fieldValue === "" || (Array.isArray(fieldValue) && fieldValue.length === 0);
    case "is_not_empty":
      return !!fieldValue && fieldValue !== "" && (!Array.isArray(fieldValue) || fieldValue.length > 0);
    default:
      return true;
  }
}

/**
 * Check if action should be visible
 */
export function shouldShowAction(
  action: PageAction,
  record?: Record<string, any>
): boolean {
  if (!action.condition) return true;
  if (!record) return false;
  return evaluateActionCondition(action.condition, record);
}
