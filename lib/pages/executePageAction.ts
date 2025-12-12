/**
 * Page Action Execution Engine
 * Executes page actions (buttons, record actions, quick automations)
 */

import { supabase } from "@/lib/supabaseClient";
import { PageAction, ActionContext, evaluateActionCondition } from "./pageActions";
import { useRouter } from "next/navigation";

export interface ExecuteActionResult {
  success: boolean;
  error?: string;
  data?: any;
}

/**
 * Execute a page action
 */
export async function executePageAction(
  action: PageAction,
  context: ActionContext
): Promise<ExecuteActionResult> {
  // Loop prevention: Check if we're already executing this action
  if ((context as any).__executingActions?.has(action.id)) {
    return { success: false, error: "Action already executing (loop prevention)" };
  }

  // Track execution
  if (!(context as any).__executingActions) {
    (context as any).__executingActions = new Set();
  }
  (context as any).__executingActions.add(action.id);

  try {
    // Check condition if present
    if (action.condition && context.record) {
      const conditionPasses = evaluateActionCondition(action.condition, context.record);
      if (!conditionPasses) {
        return { success: false, error: "Action condition not met" };
      }
    }

    let result: ExecuteActionResult;

    switch (action.type) {
      case "update_record":
        result = await executeUpdateRecord(action, context);
        break;
      
      case "create_record":
        result = await executeCreateRecord(action, context);
        break;
      
      case "delete_record":
        result = await executeDeleteRecord(action, context);
        break;
      
      case "duplicate_record":
        result = await executeDuplicateRecord(action, context);
        break;
      
      case "navigate_to_page":
        result = await executeNavigateToPage(action, context);
        break;
      
      case "open_record":
        result = await executeOpenRecord(action, context);
        break;
      
      case "send_email":
        result = await executeSendEmail(action, context);
        break;
      
      case "webhook":
        result = await executeWebhook(action, context);
        break;
      
      case "run_automation":
        result = await executeRunAutomation(action, context);
        break;
      
      case "open_url":
        result = await executeOpenUrl(action, context);
        break;
      
      case "set_field_value":
        result = await executeSetFieldValue(action, context);
        break;
      
      case "copy_to_clipboard":
        result = await executeCopyToClipboard(action, context);
        break;
      
      default:
        result = { success: false, error: `Unknown action type: ${action.type}` };
    }

    return result;
  } catch (error: any) {
    console.error("Error executing page action:", error);
    return { success: false, error: error.message || "Failed to execute action" };
  } finally {
    // Remove from executing set
    if ((context as any).__executingActions) {
      (context as any).__executingActions.delete(action.id);
    }
  }
}

async function executeUpdateRecord(
  action: PageAction,
  context: ActionContext
): Promise<ExecuteActionResult> {
  if (!action.table || !action.updates) {
    return { success: false, error: "Missing table or updates" };
  }

  const recordId = action.recordId || context.record?.id;
  if (!recordId) {
    return { success: false, error: "Missing record ID" };
  }

  const idField = action.recordIdField || "id";
  const { data, error } = await supabase
    .from(action.table)
    .update(action.updates)
    .eq(idField, recordId)
    .select()
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  // Call onRecordUpdate callback if provided
  if (context.onRecordUpdate) {
    await context.onRecordUpdate(recordId, action.updates);
  }

  return { success: true, data };
}

async function executeCreateRecord(
  action: PageAction,
  context: ActionContext
): Promise<ExecuteActionResult> {
  if (!action.table || !action.updates) {
    return { success: false, error: "Missing table or updates" };
  }

  const { data, error } = await supabase
    .from(action.table)
    .insert(action.updates)
    .select()
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data };
}

async function executeDeleteRecord(
  action: PageAction,
  context: ActionContext
): Promise<ExecuteActionResult> {
  if (!action.table) {
    return { success: false, error: "Missing table" };
  }

  const recordId = action.recordId || context.record?.id;
  if (!recordId) {
    return { success: false, error: "Missing record ID" };
  }

  const idField = action.recordIdField || "id";
  const { error } = await supabase
    .from(action.table)
    .delete()
    .eq(idField, recordId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

async function executeDuplicateRecord(
  action: PageAction,
  context: ActionContext
): Promise<ExecuteActionResult> {
  if (!action.table) {
    return { success: false, error: "Missing table" };
  }

  const recordId = action.recordId || context.record?.id;
  if (!recordId) {
    return { success: false, error: "Missing record ID" };
  }

  const idField = action.recordIdField || "id";
  
  // Fetch the original record
  const { data: original, error: fetchError } = await supabase
    .from(action.table)
    .select("*")
    .eq(idField, recordId)
    .single();

  if (fetchError || !original) {
    return { success: false, error: fetchError?.message || "Record not found" };
  }

  // Remove id and timestamps
  const { id, created_at, updated_at, ...recordData } = original;

  // Create duplicate
  const { data, error } = await supabase
    .from(action.table)
    .insert(recordData)
    .select()
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data };
}

async function executeNavigateToPage(
  action: PageAction,
  context: ActionContext
): Promise<ExecuteActionResult> {
  if (!action.pageId) {
    return { success: false, error: "Missing page ID" };
  }

  if (context.onNavigate) {
    context.onNavigate(`/pages/${action.pageId}`);
  } else if (context.router) {
    context.router.push(`/pages/${action.pageId}`);
  } else {
    // Fallback to window.location
    window.location.href = `/pages/${action.pageId}`;
  }

  return { success: true };
}

async function executeOpenRecord(
  action: PageAction,
  context: ActionContext
): Promise<ExecuteActionResult> {
  const recordId = action.recordId || context.record?.id;
  if (!recordId || !action.table) {
    return { success: false, error: "Missing record ID or table" };
  }

  // This would typically open a record drawer or navigate to record page
  // For now, we'll use the onNavigate callback if available
  if (context.onNavigate) {
    context.onNavigate(`/tables/${action.table}/${recordId}`);
  }

  return { success: true };
}

async function executeSendEmail(
  action: PageAction,
  context: ActionContext
): Promise<ExecuteActionResult> {
  if (!action.emailTo || !action.emailSubject) {
    return { success: false, error: "Missing email details" };
  }

  try {
    const response = await fetch("/api/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: action.emailTo,
        subject: action.emailSubject,
        body: action.emailBody || "",
        record: context.record,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      return { success: false, error: error.error || "Failed to send email" };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

async function executeWebhook(
  action: PageAction,
  context: ActionContext
): Promise<ExecuteActionResult> {
  if (!action.webhookUrl) {
    return { success: false, error: "Missing webhook URL" };
  }

  try {
    const method = action.webhookMethod || "POST";
    const body = action.webhookBody || { record: context.record };

    const response = await fetch(action.webhookUrl, {
      method,
      headers: { "Content-Type": "application/json" },
      body: method !== "GET" ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      return { success: false, error: `Webhook returned ${response.status}` };
    }

    const data = await response.json().catch(() => ({}));
    return { success: true, data };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

async function executeRunAutomation(
  action: PageAction,
  context: ActionContext
): Promise<ExecuteActionResult> {
  if (!action.automationId) {
    return { success: false, error: "Missing automation ID" };
  }

  try {
    const response = await fetch(`/api/automations/${action.automationId}/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        record: context.record,
        newRecord: context.record,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      return { success: false, error: error.error || "Failed to run automation" };
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

async function executeOpenUrl(
  action: PageAction,
  context: ActionContext
): Promise<ExecuteActionResult> {
  if (!action.url) {
    return { success: false, error: "Missing URL" };
  }

  // Replace placeholders in URL
  let url = action.url;
  if (context.record) {
    Object.keys(context.record).forEach((key) => {
      url = url.replace(`{${key}}`, String(context.record![key] || ""));
    });
  }

  window.open(url, "_blank");
  return { success: true };
}

async function executeSetFieldValue(
  action: PageAction,
  context: ActionContext
): Promise<ExecuteActionResult> {
  if (!action.fieldKey || action.fieldValue === undefined) {
    return { success: false, error: "Missing field key or value" };
  }

  if (!context.record?.id || !action.table) {
    return { success: false, error: "Missing record ID or table" };
  }

  const updates = { [action.fieldKey]: action.fieldValue };
  return await executeUpdateRecord({ ...action, updates }, context);
}

async function executeCopyToClipboard(
  action: PageAction,
  context: ActionContext
): Promise<ExecuteActionResult> {
  let textToCopy = action.fieldKey && context.record
    ? String(context.record[action.fieldKey] || "")
    : "";

  if (context.onCopyToClipboard) {
    await context.onCopyToClipboard(textToCopy);
  } else if (navigator.clipboard) {
    await navigator.clipboard.writeText(textToCopy);
  } else {
    return { success: false, error: "Clipboard API not available" };
  }

  return { success: true };
}
