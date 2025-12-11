/**
 * Action Engine for Automations
 * Executes actions defined in automation workflows
 * 
 * Matches schema definitions from lib/automations/schema.ts
 */

import { SupabaseClient } from "@supabase/supabase-js";
import {
  UpdateRecordAction,
  CreateRecordAction,
  DeleteRecordAction,
  SendEmailAction,
  SendWebhookAction,
  SetFieldValueAction,
  AutomationAction,
} from "./schema";
import { Automation } from "@/lib/types/automations";

export interface ActionContext {
  record?: any;
  oldRecord?: any;
  newRecord?: any;
  automation?: Automation;
  supabase: SupabaseClient;
  logger?: (message: string, data?: any) => void;
}

export interface ActionResult {
  success: boolean;
  output?: any;
  error?: string;
}

/**
 * Execute send_email action
 */
async function executeSendEmail(
  action: SendEmailAction,
  context: ActionContext
): Promise<ActionResult> {
  try {
    // Replace template variables in subject and body
    let subject = action.subject;
    let body = action.body || "";

    if (context.record) {
      // Replace {{field_key}} with actual values
      Object.keys(context.record).forEach((key) => {
        const value = context.record[key];
        const regex = new RegExp(`{{${key}}}`, "g");
        subject = subject.replace(regex, String(value || ""));
        body = body.replace(regex, String(value || ""));
      });
    }

    // TODO: Integrate with your email service (SendGrid, Resend, etc.)
    // For now, this is a placeholder
    context.logger?.("Sending email", { to: action.to, subject, body });

    // Example: Call your email API endpoint
    // const response = await fetch('/api/send-email', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ to: action.to, subject, body, from: action.from })
    // });

    return {
      success: true,
      output: { sent: true, to: action.to },
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Failed to send email",
    };
  }
}

/**
 * Execute webhook action
 */
async function executeWebhook(
  action: SendWebhookAction,
  context: ActionContext
): Promise<ActionResult> {
  try {
    const method = action.method || "POST";
    const headers = {
      "Content-Type": "application/json",
      ...action.headers,
    };

    // Replace template variables in body if it's a string
    let body = action.body;
    if (typeof body === "string" && context.record) {
      Object.keys(context.record).forEach((key) => {
        const value = context.record[key];
        const regex = new RegExp(`{{${key}}}`, "g");
        body = body.replace(regex, String(value || ""));
      });
    }

    const response = await fetch(action.url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const responseData = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(`Webhook error: ${response.statusText}`);
    }

    return {
      success: true,
      output: responseData,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Failed to execute webhook",
    };
  }
}

/**
 * Execute update_record action
 */
async function executeUpdateRecord(
  action: UpdateRecordAction,
  context: ActionContext
): Promise<ActionResult> {
  try {
    // Resolve table name from table_id if needed
    let tableName = action.table_name || action.table_id;
    
    // If table_id is a UUID, we need to get the table name
    if (action.table_id && !action.table_name) {
      const { data: table } = await context.supabase
        .from("tables")
        .select("name")
        .eq("id", action.table_id)
        .single();
      
      if (table) {
        tableName = table.name;
      }
    }

    if (!tableName) {
      throw new Error("Table name or table_id is required");
    }

    // Use record_id from action, or fall back to context.record.id
    const recordId = action.record_id || context.record?.id;
    if (!recordId) {
      throw new Error("Record ID is required");
    }

    // Replace template variables in field_updates
    const updates: Record<string, any> = {};
    Object.keys(action.field_updates).forEach((key) => {
      let value = action.field_updates[key];
      
      // If value is a string with template variables, replace them
      if (typeof value === "string" && context.record) {
        Object.keys(context.record).forEach((fieldKey) => {
          const fieldValue = context.record[fieldKey];
          const regex = new RegExp(`{{${fieldKey}}}`, "g");
          value = value.replace(regex, String(fieldValue || ""));
        });
      }
      
      updates[key] = value;
    });

    const { data, error } = await context.supabase
      .from(tableName)
      .update(updates)
      .eq("id", recordId)
      .select()
      .single();

    if (error) throw error;

    return {
      success: true,
      output: data,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Failed to update record",
    };
  }
}

/**
 * Execute create_record action
 */
async function executeCreateRecord(
  action: CreateRecordAction,
  context: ActionContext
): Promise<ActionResult> {
  try {
    // Resolve table name from table_id if needed
    let tableName = action.table_name || action.table_id;
    
    // If table_id is a UUID, we need to get the table name
    if (action.table_id && !action.table_name) {
      const { data: table } = await context.supabase
        .from("tables")
        .select("name")
        .eq("id", action.table_id)
        .single();
      
      if (table) {
        tableName = table.name;
      }
    }

    if (!tableName) {
      throw new Error("Table name or table_id is required");
    }

    // Replace template variables in field_values
    const fieldValues: Record<string, any> = {};
    Object.keys(action.field_values).forEach((key) => {
      let value = action.field_values[key];
      
      // If value is a string with template variables, replace them
      if (typeof value === "string" && context.record) {
        Object.keys(context.record).forEach((fieldKey) => {
          const fieldValue = context.record[fieldKey];
          const regex = new RegExp(`{{${fieldKey}}}`, "g");
          value = value.replace(regex, String(fieldValue || ""));
        });
      }
      
      fieldValues[key] = value;
    });

    const { data, error } = await context.supabase
      .from(tableName)
      .insert(fieldValues)
      .select()
      .single();

    if (error) throw error;

    return {
      success: true,
      output: data,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Failed to create record",
    };
  }
}

/**
 * Execute delete_record action
 */
async function executeDeleteRecord(
  action: DeleteRecordAction,
  context: ActionContext
): Promise<ActionResult> {
  try {
    // Resolve table name from table_id if needed
    let tableName = action.table_name || action.table_id;
    
    // If table_id is a UUID, we need to get the table name
    if (action.table_id && !action.table_name) {
      const { data: table } = await context.supabase
        .from("tables")
        .select("name")
        .eq("id", action.table_id)
        .single();
      
      if (table) {
        tableName = table.name;
      }
    }

    if (!tableName) {
      throw new Error("Table name or table_id is required");
    }

    // Use record_id from action, or fall back to context.record.id
    const recordId = action.record_id || context.record?.id;
    if (!recordId) {
      throw new Error("Record ID is required");
    }

    const { error } = await context.supabase
      .from(tableName)
      .delete()
      .eq("id", recordId);

    if (error) throw error;

    return {
      success: true,
      output: { deleted: true, id: recordId },
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Failed to delete record",
    };
  }
}

/**
 * Execute set_field_value action
 */
async function executeSetFieldValue(
  action: SetFieldValueAction,
  context: ActionContext
): Promise<ActionResult> {
  try {
    // This action updates the current record (from trigger context)
    if (!context.record || !context.record.id) {
      throw new Error("No record in context for set_field_value action");
    }

    // We need to know which table the record belongs to
    // This should be provided by the trigger context
    // For now, we'll need to infer it or require it in the action
    throw new Error("set_field_value action requires table context - not yet fully implemented");

    // TODO: Implement when we have table context
    return {
      success: false,
      error: "set_field_value action not yet fully implemented",
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Failed to set field value",
    };
  }
}

/**
 * Main function to execute an action
 */
export async function executeAction(
  action: AutomationAction,
  context: ActionContext
): Promise<ActionResult> {
  switch (action.type) {
    case "send_email":
      return executeSendEmail(action, context);

    case "send_webhook":
      return executeWebhook(action, context);

    case "update_record":
      return executeUpdateRecord(action, context);

    case "create_record":
      return executeCreateRecord(action, context);

    case "delete_record":
      return executeDeleteRecord(action, context);

    case "set_field_value":
      return executeSetFieldValue(action, context);

    default:
      return {
        success: false,
        error: `Unknown action type: ${(action as any).type}`,
      };
  }
}

/**
 * Execute multiple actions in sequence
 * Must not throw globally - errors must be collected for logging
 * Return array of action results
 */
export async function executeActions(
  actions: AutomationAction[],
  context: ActionContext
): Promise<ActionResult[]> {
  const results: ActionResult[] = [];

  for (const action of actions) {
    try {
      const result = await executeAction(action, context);
      results.push(result);

      // Continue executing remaining actions even if one fails
    } catch (error: any) {
      // Collect error but don't throw
      results.push({
        success: false,
        error: error.message || "Unknown error executing action",
      });
    }
  }

  return results;
}
