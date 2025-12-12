/**
 * Quick Automations System
 * Per-page mini automations that execute immediately
 */

import { QuickAutomation, PageAction } from "./pageActions";
import { executePageAction, ActionContext } from "./executePageAction";
import { evaluateActionCondition } from "./pageActions";

export interface QuickAutomationContext extends ActionContext {
  oldRecord?: Record<string, any>;
  newRecord?: Record<string, any>;
}

/**
 * Execute a quick automation
 */
export async function executeQuickAutomation(
  automation: QuickAutomation,
  context: QuickAutomationContext
): Promise<{ success: boolean; error?: string }> {
  try {
    // Check trigger
    const shouldTrigger = checkTrigger(automation.trigger, context);
    if (!shouldTrigger) {
      return { success: false, error: "Trigger conditions not met" };
    }

    // Execute all actions
    const results = await Promise.all(
      automation.actions.map(action => executePageAction(action, context))
    );

    const allSucceeded = results.every(r => r.success);
    const errors = results.filter(r => !r.success).map(r => r.error).join("; ");

    return {
      success: allSucceeded,
      error: allSucceeded ? undefined : errors,
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Check if trigger conditions are met
 */
function checkTrigger(
  trigger: QuickAutomation["trigger"],
  context: QuickAutomationContext
): boolean {
  if (trigger.type === "manual") {
    return true; // Manual triggers always fire
  }

  if (trigger.type === "record_created") {
    return !!context.newRecord && !context.oldRecord;
  }

  if (trigger.type === "record_updated") {
    return !!context.newRecord && !!context.oldRecord;
  }

  if (trigger.type === "field_match" && context.record) {
    if (!trigger.conditions || trigger.conditions.length === 0) {
      return true;
    }

    // All conditions must pass
    return trigger.conditions.every(condition =>
      evaluateActionCondition(condition, context.record)
    );
  }

  return false;
}

/**
 * Execute all quick automations for a page
 */
export async function executePageQuickAutomations(
  automations: QuickAutomation[],
  context: QuickAutomationContext
): Promise<void> {
  // Prevent infinite loops by tracking execution
  const executionKey = `quick-auto-${Date.now()}`;
  if ((context as any).__executingQuickAutomations) {
    return; // Already executing, prevent loop
  }

  (context as any).__executingQuickAutomations = executionKey;

  try {
    await Promise.all(
      automations.map(auto => executeQuickAutomation(auto, context))
    );
  } finally {
    if ((context as any).__executingQuickAutomations === executionKey) {
      delete (context as any).__executingQuickAutomations;
    }
  }
}
