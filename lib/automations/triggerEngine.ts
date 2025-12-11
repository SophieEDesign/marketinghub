/**
 * Trigger Engine for Automations
 * Evaluates whether an automation should run based on its trigger configuration
 * 
 * Matches schema definitions from lib/automations/schema.ts
 */

import {
  ScheduleTrigger,
  RecordCreatedTrigger,
  RecordUpdatedTrigger,
  FieldMatchTrigger,
  DateApproachingTrigger,
  ManualTrigger,
  AutomationTrigger,
} from "./schema";

/**
 * Check if a schedule trigger should run at the current time
 */
export function shouldRunScheduleTrigger(
  trigger: ScheduleTrigger,
  now: Date = new Date()
): boolean {
  const hour = now.getHours();
  const minute = now.getMinutes();
  const dayOfWeek = now.getDay();
  const dayOfMonth = now.getDate();

  const schedule = trigger.schedule;

  switch (schedule.frequency) {
    case "daily":
      // Run at the specified time each day
      if (schedule.time) {
        const [triggerHour, triggerMinute] = schedule.time.split(":").map(Number);
        return hour === triggerHour && minute === triggerMinute;
      }
      return false; // No time specified

    case "weekly":
      // Run on specified day of week at specified time
      if (schedule.dayOfWeek !== undefined) {
        if (dayOfWeek !== schedule.dayOfWeek) return false;
        if (schedule.time) {
          const [triggerHour, triggerMinute] = schedule.time.split(":").map(Number);
          return hour === triggerHour && minute === triggerMinute;
        }
        return true; // Day matches, no time specified
      }
      return false;

    case "monthly":
      // Run on specified day of month at specified time
      if (schedule.dayOfMonth !== undefined) {
        if (dayOfMonth !== schedule.dayOfMonth) return false;
        if (schedule.time) {
          const [triggerHour, triggerMinute] = schedule.time.split(":").map(Number);
          return hour === triggerHour && minute === triggerMinute;
        }
        return true; // Day matches, no time specified
      }
      return false;

    case "custom":
      // For custom cron expressions, we'd need a cron parser
      // For now, return false - this should be handled by external scheduler
      if (schedule.cron) {
        // TODO: Implement cron parsing if needed
        return false;
      }
      return false;

    default:
      return false;
  }
}

/**
 * Check if a record created trigger should run
 * Note: This is typically called when a record is created
 */
export function shouldRunRecordCreatedTrigger(
  trigger: RecordCreatedTrigger,
  record: any
): boolean {
  // If we're checking this, the record was just created
  // The table_id matching should be done by the caller
  return true;
}

/**
 * Check if a record updated trigger should run
 */
export function shouldRunRecordUpdatedTrigger(
  trigger: RecordUpdatedTrigger,
  oldRecord: any,
  newRecord: any
): boolean {
  // If specific field filters are specified, check if those fields changed
  if (trigger.field_filters && trigger.field_filters.length > 0) {
    return trigger.field_filters.some((filter) => {
      const oldValue = oldRecord?.[filter.field_key];
      const newValue = newRecord?.[filter.field_key];

      switch (filter.operator) {
        case "changed":
          return oldValue !== newValue;
        case "equals":
          return newValue === filter.value;
        case "not_equals":
          return newValue !== filter.value;
        default:
          return oldValue !== newValue; // Default to "changed"
      }
    });
  }
  // Otherwise, trigger on any update
  return true;
}

/**
 * Check if a field match trigger should run
 */
export function shouldRunFieldMatchTrigger(
  trigger: FieldMatchTrigger,
  record: any
): boolean {
  const fieldValue = record[trigger.field_key];

  switch (trigger.operator) {
    case "equals":
      return fieldValue === trigger.value;
    case "not_equals":
      return fieldValue !== trigger.value;
    case "contains":
      return String(fieldValue || "").toLowerCase().includes(
        String(trigger.value || "").toLowerCase()
      );
    case "greater_than":
      return Number(fieldValue) > Number(trigger.value);
    case "less_than":
      return Number(fieldValue) < Number(trigger.value);
    default:
      return false;
  }
}

/**
 * Check if a date approaching trigger should run
 */
export function shouldRunDateApproachingTrigger(
  trigger: DateApproachingTrigger,
  record: any
): boolean {
  const dateValue = record[trigger.date_field_key];
  if (!dateValue) return false;

  const targetDate = new Date(dateValue);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  targetDate.setHours(0, 0, 0, 0);

  const diffTime = targetDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  // Trigger if the date is exactly X days away (or within the day range)
  return diffDays >= 0 && diffDays <= trigger.days_before;
}

/**
 * Check if a manual trigger should run
 * Manual triggers must ONLY run when explicitly requested, not via cron
 */
export function isManualTrigger(trigger: ManualTrigger): boolean {
  return trigger.type === "manual";
}

/**
 * Main function to evaluate if a trigger should run
 */
export function evaluateTrigger(
  trigger: AutomationTrigger,
  context?: {
    now?: Date;
    record?: any;
    oldRecord?: any;
    newRecord?: any;
  }
): boolean {
  const now = context?.now || new Date();

  switch (trigger.type) {
    case "schedule":
      return shouldRunScheduleTrigger(trigger, now);

    case "record_created":
      if (context?.record) {
        return shouldRunRecordCreatedTrigger(trigger, context.record);
      }
      return false;

    case "record_updated":
      if (context?.oldRecord && context?.newRecord) {
        return shouldRunRecordUpdatedTrigger(
          trigger,
          context.oldRecord,
          context.newRecord
        );
      }
      return false;

    case "field_match":
      if (context?.record) {
        return shouldRunFieldMatchTrigger(trigger, context.record);
      }
      return false;

    case "date_approaching":
      if (context?.record) {
        return shouldRunDateApproachingTrigger(trigger, context.record);
      }
      return false;

    case "manual":
      // Manual triggers should only run when explicitly called
      // Return false here - they'll be handled separately
      return false;

    default:
      console.warn(`Unknown trigger type: ${(trigger as any).type}`);
      return false;
  }
}
