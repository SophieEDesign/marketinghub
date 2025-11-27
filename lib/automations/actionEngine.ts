/**
 * Action Engine for Automations
 * Executes actions defined in automation workflows
 */

import { supabase } from "@/lib/supabaseClient";

export interface SendEmailAction {
  type: "send_email";
  to: string;
  subject: string;
  template?: string;
  body?: string;
  data?: Record<string, any>;
}

export interface SlackMessageAction {
  type: "slack_message";
  webhook_url: string;
  message: string;
  channel?: string;
}

export interface WebhookAction {
  type: "webhook";
  url: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  headers?: Record<string, string>;
  body?: any;
}

export interface UpdateRecordAction {
  type: "update_record";
  table: string;
  recordId: string;
  updates: Record<string, any>;
}

export interface CreateRecordAction {
  type: "create_record";
  table: string;
  data: Record<string, any>;
}

export interface DuplicateRecordAction {
  type: "duplicate_record";
  table: string;
  recordId: string;
  excludeFields?: string[];
}

export interface RunScriptAction {
  type: "run_script";
  script: string;
  timeout?: number; // milliseconds
}

export type AutomationAction =
  | SendEmailAction
  | SlackMessageAction
  | WebhookAction
  | UpdateRecordAction
  | CreateRecordAction
  | DuplicateRecordAction
  | RunScriptAction;

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
  context?: Record<string, any>
): Promise<ActionResult> {
  try {
    // Replace template variables with data
    let body = action.body || action.template || "";
    if (action.data) {
      Object.keys(action.data).forEach((key) => {
        body = body.replace(new RegExp(`{{${key}}}`, "g"), action.data![key]);
      });
    }

    // TODO: Integrate with your email service (SendGrid, Resend, etc.)
    // For now, this is a placeholder
    console.log("Sending email:", {
      to: action.to,
      subject: action.subject,
      body,
    });

    // Example: Call your email API endpoint
    // const response = await fetch('/api/send-email', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ to: action.to, subject: action.subject, body })
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
 * Execute slack_message action
 */
async function executeSlackMessage(
  action: SlackMessageAction,
  context?: Record<string, any>
): Promise<ActionResult> {
  try {
    const response = await fetch(action.webhook_url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: action.message,
        channel: action.channel,
      }),
    });

    if (!response.ok) {
      throw new Error(`Slack API error: ${response.statusText}`);
    }

    return {
      success: true,
      output: { sent: true },
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Failed to send Slack message",
    };
  }
}

/**
 * Execute webhook action
 */
async function executeWebhook(
  action: WebhookAction,
  context?: Record<string, any>
): Promise<ActionResult> {
  try {
    const method = action.method || "POST";
    const headers = {
      "Content-Type": "application/json",
      ...action.headers,
    };

    const response = await fetch(action.url, {
      method,
      headers,
      body: action.body ? JSON.stringify(action.body) : undefined,
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
  context?: Record<string, any>
): Promise<ActionResult> {
  try {
    const { data, error } = await supabase
      .from(action.table)
      .update(action.updates)
      .eq("id", action.recordId)
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
  context?: Record<string, any>
): Promise<ActionResult> {
  try {
    const { data, error } = await supabase
      .from(action.table)
      .insert(action.data)
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
 * Execute duplicate_record action
 */
async function executeDuplicateRecord(
  action: DuplicateRecordAction,
  context?: Record<string, any>
): Promise<ActionResult> {
  try {
    // First, fetch the original record
    const { data: original, error: fetchError } = await supabase
      .from(action.table)
      .select("*")
      .eq("id", action.recordId)
      .single();

    if (fetchError) throw fetchError;

    // Remove excluded fields and id
    const excludeFields = new Set(["id", "created_at", "updated_at", ...(action.excludeFields || [])]);
    const newData: Record<string, any> = {};

    Object.keys(original).forEach((key) => {
      if (!excludeFields.has(key)) {
        newData[key] = original[key];
      }
    });

    // Create the duplicate
    const { data, error } = await supabase
      .from(action.table)
      .insert(newData)
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
      error: error.message || "Failed to duplicate record",
    };
  }
}

/**
 * Execute run_script action (sandboxed JavaScript)
 */
async function executeRunScript(
  action: RunScriptAction,
  context?: Record<string, any>
): Promise<ActionResult> {
  try {
    // WARNING: Running user-provided scripts is a security risk
    // In production, use a proper sandbox like vm2 or a separate service
    // This is a basic implementation for demonstration

    const timeout = action.timeout || 5000; // Default 5 seconds

    // Create a safe execution context
    const safeContext = {
      ...context,
      // Provide safe utilities
      console: {
        log: (...args: any[]) => console.log("[Automation Script]", ...args),
        error: (...args: any[]) => console.error("[Automation Script]", ...args),
      },
      // Block dangerous operations
      require: undefined,
      process: undefined,
      global: undefined,
      eval: undefined,
      Function: undefined,
    };

    // Execute with timeout
    const result = await Promise.race([
      new Promise((resolve) => {
        try {
          // Use Function constructor in a controlled way
          const func = new Function(
            ...Object.keys(safeContext),
            action.script
          );
          const output = func(...Object.values(safeContext));
          resolve(output);
        } catch (error: any) {
          resolve({ error: error.message });
        }
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Script timeout")), timeout)
      ),
    ]);

    return {
      success: true,
      output: result,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Failed to execute script",
    };
  }
}

/**
 * Main function to execute an action
 */
export async function executeAction(
  action: AutomationAction,
  context?: Record<string, any>
): Promise<ActionResult> {
  switch (action.type) {
    case "send_email":
      return executeSendEmail(action, context);

    case "slack_message":
      return executeSlackMessage(action, context);

    case "webhook":
      return executeWebhook(action, context);

    case "update_record":
      return executeUpdateRecord(action, context);

    case "create_record":
      return executeCreateRecord(action, context);

    case "duplicate_record":
      return executeDuplicateRecord(action, context);

    case "run_script":
      return executeRunScript(action, context);

    default:
      return {
        success: false,
        error: `Unknown action type: ${(action as any).type}`,
      };
  }
}

/**
 * Execute multiple actions in sequence
 */
export async function executeActions(
  actions: AutomationAction[],
  context?: Record<string, any>
): Promise<ActionResult[]> {
  const results: ActionResult[] = [];

  for (const action of actions) {
    const result = await executeAction(action, context);
    results.push(result);

    // If an action fails, you might want to stop or continue
    // For now, we continue executing remaining actions
  }

  return results;
}

