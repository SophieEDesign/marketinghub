/**
 * JSON Schema definitions for Automations Suite
 * Defines the structure for triggers, conditions, and actions
 * 
 * NOTE: This file contains schema definitions only.
 * Execution logic will be implemented in separate files.
 */

// ============================================
// TRIGGER SCHEMAS
// ============================================

/**
 * Schedule Trigger
 * Runs automation on a recurring schedule
 */
export interface ScheduleTrigger {
  type: 'schedule';
  schedule: {
    frequency: 'daily' | 'weekly' | 'monthly' | 'custom';
    time?: string; // HH:MM format
    dayOfWeek?: number; // 0-6 (Sunday-Saturday)
    dayOfMonth?: number; // 1-31
    cron?: string; // Custom cron expression
  };
}

/**
 * Record Created Trigger
 * Fires when a new record is created in a table
 */
export interface RecordCreatedTrigger {
  type: 'record_created';
  table_id: string; // UUID of the table
  table_name?: string; // Optional: table name for reference
}

/**
 * Record Updated Trigger
 * Fires when a record is updated in a table
 */
export interface RecordUpdatedTrigger {
  type: 'record_updated';
  table_id: string; // UUID of the table
  table_name?: string; // Optional: table name for reference
  field_filters?: Array<{
    field_key: string;
    operator: 'changed' | 'equals' | 'not_equals';
    value?: any;
  }>;
}

/**
 * Field Match Trigger
 * Fires when a specific field matches a condition
 */
export interface FieldMatchTrigger {
  type: 'field_match';
  table_id: string;
  table_name?: string;
  field_key: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than';
  value: any;
}

/**
 * Date Approaching Trigger
 * Fires when a date field is approaching a specified time
 */
export interface DateApproachingTrigger {
  type: 'date_approaching';
  table_id: string;
  table_name?: string;
  date_field_key: string;
  days_before: number; // Number of days before the date
  time?: string; // HH:MM format for when to check
}

/**
 * Manual Trigger
 * Automation can only be triggered manually
 */
export interface ManualTrigger {
  type: 'manual';
}

/**
 * Union type for all trigger types
 */
export type AutomationTrigger =
  | ScheduleTrigger
  | RecordCreatedTrigger
  | RecordUpdatedTrigger
  | FieldMatchTrigger
  | DateApproachingTrigger
  | ManualTrigger;

// ============================================
// CONDITION SCHEMAS
// ============================================

/**
 * Field Condition
 * Checks if a field meets a condition
 */
export interface FieldCondition {
  type: 'field';
  field_key: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than' | 'is_empty' | 'is_not_empty';
  value?: any;
}

/**
 * Date Condition
 * Checks if a date field meets a condition
 */
export interface DateCondition {
  type: 'date';
  field_key: string;
  operator: 'before' | 'after' | 'between' | 'equals';
  value?: string | { start: string; end: string };
}

/**
 * Related Record Condition
 * Checks if a related record (via linked_record field) meets conditions
 */
export interface RelatedRecordCondition {
  type: 'related_record';
  field_key: string; // linked_record field
  conditions: Condition[]; // Nested conditions to check on related record
}

/**
 * Logic Condition
 * Combines multiple conditions with AND/OR logic
 */
export interface LogicCondition {
  type: 'logic';
  operator: 'and' | 'or';
  conditions: Condition[];
}

/**
 * Union type for all condition types
 */
export type Condition =
  | FieldCondition
  | DateCondition
  | RelatedRecordCondition
  | LogicCondition;

// ============================================
// ACTION SCHEMAS
// ============================================

/**
 * Update Record Action
 * Updates fields on a record
 */
export interface UpdateRecordAction {
  type: 'update_record';
  table_id: string;
  table_name?: string;
  record_id?: string; // If not provided, uses trigger context
  field_updates: Record<string, any>; // field_key -> value mappings
}

/**
 * Create Record Action
 * Creates a new record in a table
 */
export interface CreateRecordAction {
  type: 'create_record';
  table_id: string;
  table_name?: string;
  field_values: Record<string, any>; // field_key -> value mappings
}

/**
 * Delete Record Action
 * Deletes a record
 */
export interface DeleteRecordAction {
  type: 'delete_record';
  table_id: string;
  table_name?: string;
  record_id?: string; // If not provided, uses trigger context
}

/**
 * Send Email Action
 * Sends an email notification
 */
export interface SendEmailAction {
  type: 'send_email';
  to: string | string[]; // Email address(es) or field reference
  subject: string; // Can include template variables
  body: string; // Can include template variables (HTML or plain text)
  from?: string; // Optional sender email
}

/**
 * Send Webhook Action
 * Sends data to an external webhook URL
 */
export interface SendWebhookAction {
  type: 'send_webhook';
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body?: any; // JSON payload
}

/**
 * Set Field Value Action
 * Sets a field value on the current record (trigger context)
 */
export interface SetFieldValueAction {
  type: 'set_field_value';
  field_key: string;
  value: any; // Can be static or computed from other fields
}

/**
 * Union type for all action types
 */
export type AutomationAction =
  | UpdateRecordAction
  | CreateRecordAction
  | DeleteRecordAction
  | SendEmailAction
  | SendWebhookAction
  | SetFieldValueAction;

// ============================================
// SCHEMA VALIDATION HELPERS (for future use)
// ============================================

/**
 * Validates a trigger schema
 * (Implementation will be added in execution layer)
 */
export function validateTrigger(trigger: any): trigger is AutomationTrigger {
  // TODO: Implement validation logic
  return true;
}

/**
 * Validates a condition schema
 * (Implementation will be added in execution layer)
 */
export function validateCondition(condition: any): condition is Condition {
  // TODO: Implement validation logic
  return true;
}

/**
 * Validates an action schema
 * (Implementation will be added in execution layer)
 */
export function validateAction(action: any): action is AutomationAction {
  // TODO: Implement validation logic
  return true;
}
