import { Automation } from "@/lib/types/automations";
import { AutomationTrigger, AutomationAction } from "@/lib/automations/schema";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateAutomation(automation: Partial<Automation>): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Name validation
  if (!automation.name || !automation.name.trim()) {
    errors.push("Automation name is required");
  }

  // Trigger validation
  if (!automation.trigger) {
    errors.push("Trigger is required");
  } else {
    const trigger = automation.trigger as AutomationTrigger;

    switch (trigger.type) {
      case "schedule":
        const schedule = (trigger as any).schedule;
        if (!schedule || !schedule.frequency) {
          errors.push("Schedule trigger must include frequency");
        } else {
          if (
            schedule.frequency === "daily" ||
            schedule.frequency === "weekly" ||
            schedule.frequency === "monthly"
          ) {
            if (!schedule.time) {
              errors.push(`${schedule.frequency} schedule must include time`);
            }
          }
          if (schedule.frequency === "weekly" && schedule.dayOfWeek === undefined) {
            warnings.push("Weekly schedule should specify day of week");
          }
          if (schedule.frequency === "monthly" && schedule.dayOfMonth === undefined) {
            warnings.push("Monthly schedule should specify day of month");
          }
          // Warn about frequent schedules
          if (schedule.frequency === "hourly" || schedule.frequency === "minutely") {
            warnings.push("This automation will run very frequently. Consider using a less frequent schedule.");
          }
        }
        break;

      case "record_created":
      case "record_updated":
        if (!(trigger as any).table_id && !(trigger as any).table_name) {
          errors.push(`${trigger.type} trigger must include table_id or table_name`);
        }
        break;

      case "field_match":
        if (!(trigger as any).table_id && !(trigger as any).table_name) {
          errors.push("field_match trigger must include table_id or table_name");
        }
        if (!(trigger as any).field_key) {
          errors.push("field_match trigger must include field_key");
        }
        if (!(trigger as any).operator) {
          errors.push("field_match trigger must include operator");
        }
        if ((trigger as any).value === undefined || (trigger as any).value === null) {
          errors.push("field_match trigger must include value");
        }
        break;

      case "date_approaching":
        if (!(trigger as any).table_id && !(trigger as any).table_name) {
          errors.push("date_approaching trigger must include table_id or table_name");
        }
        if (!(trigger as any).date_field_key) {
          errors.push("date_approaching trigger must include date_field_key");
        }
        if (!(trigger as any).days_before || (trigger as any).days_before < 0) {
          errors.push("date_approaching trigger must include days_before (>= 0)");
        }
        break;

      case "manual":
        // Manual triggers don't need additional validation
        break;

      default:
        errors.push(`Unknown trigger type: ${(trigger as any).type}`);
    }
  }

  // Actions validation
  if (!automation.actions || automation.actions.length === 0) {
    errors.push("At least one action is required");
  } else {
    automation.actions.forEach((action, index) => {
      const actionErrors = validateAction(action, index, warnings);
      errors.push(...actionErrors);
    });
  }

  // Conditions validation (optional, but warn if empty for certain triggers)
  if (!automation.conditions || automation.conditions.length === 0) {
    if (
      automation.trigger &&
      ((automation.trigger as any).type === "record_created" ||
        (automation.trigger as any).type === "record_updated")
    ) {
      warnings.push("No conditions specified. Automation will run for all records matching the trigger.");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

function validateAction(action: AutomationAction, index: number, warnings: string[]): string[] {
  const errors: string[] = [];
  const prefix = `Action ${index + 1}`;

  if (!action.type) {
    errors.push(`${prefix}: Action type is required`);
    return errors;
  }

  switch (action.type) {
    case "send_email":
      if (!(action as any).to || !String((action as any).to).trim()) {
        errors.push(`${prefix} (send_email): 'to' field is required`);
      }
      if (!(action as any).subject || !String((action as any).subject).trim()) {
        errors.push(`${prefix} (send_email): 'subject' field is required`);
      }
      if (!(action as any).body || !String((action as any).body).trim()) {
        errors.push(`${prefix} (send_email): 'body' field is required`);
      }
      break;

    case "send_webhook":
      if (!(action as any).url || !String((action as any).url).trim()) {
        errors.push(`${prefix} (send_webhook): 'url' field is required`);
      }
      if (!(action as any).method) {
        errors.push(`${prefix} (send_webhook): 'method' field is required`);
      }
      break;

    case "update_record":
      if (!(action as any).table_id && !(action as any).table_name) {
        errors.push(`${prefix} (update_record): 'table_id' or 'table_name' is required`);
      }
      if (!(action as any).field_updates || Object.keys((action as any).field_updates || {}).length === 0) {
        errors.push(`${prefix} (update_record): 'field_updates' must contain at least one field`);
      }
      break;

    case "create_record":
      if (!(action as any).table_id && !(action as any).table_name) {
        errors.push(`${prefix} (create_record): 'table_id' or 'table_name' is required`);
      }
      if (!(action as any).field_values || Object.keys((action as any).field_values || {}).length === 0) {
        warnings.push(`${prefix} (create_record): 'field_values' is empty. Record will be created with only system fields.`);
      }
      break;

    case "delete_record":
      if (!(action as any).table_id && !(action as any).table_name) {
        errors.push(`${prefix} (delete_record): 'table_id' or 'table_name' is required`);
      }
      if (!(action as any).record_id) {
        warnings.push(`${prefix} (delete_record): 'record_id' not specified. Will use trigger context if available.`);
      }
      break;

    case "set_field_value":
      if (!(action as any).field_key) {
        errors.push(`${prefix} (set_field_value): 'field_key' is required`);
      }
      if ((action as any).value === undefined || (action as any).value === null) {
        errors.push(`${prefix} (set_field_value): 'value' is required`);
      }
      break;

    default:
      errors.push(`${prefix}: Unknown action type '${(action as any).type}'`);
  }

  return errors;
}
