/**
 * Trigger Engine for Automations
 * Evaluates whether an automation should run based on its trigger configuration
 */

export interface ScheduleTrigger {
  type: "schedule";
  frequency: "daily" | "weekly" | "monthly" | "hourly" | "minutely";
  time?: string; // HH:mm format for daily
  dayOfWeek?: number; // 0-6 for weekly (0 = Sunday)
  dayOfMonth?: number; // 1-31 for monthly
  minute?: number; // 0-59 for hourly
}

export interface RecordCreatedTrigger {
  type: "record_created";
  table: string;
}

export interface RecordUpdatedTrigger {
  type: "record_updated";
  table: string;
  fields?: string[]; // Only trigger if these fields changed
}

export interface FieldMatchTrigger {
  type: "field_match";
  table: string;
  field: string;
  operator: "equals" | "not_equals" | "contains" | ">" | "<" | ">=" | "<=";
  value: any;
}

export interface DateApproachingTrigger {
  type: "date_approaching";
  table: string;
  dateField: string;
  daysBefore: number; // Trigger X days before the date
}

export interface ManualTrigger {
  type: "manual";
}

export type AutomationTrigger =
  | ScheduleTrigger
  | RecordCreatedTrigger
  | RecordUpdatedTrigger
  | FieldMatchTrigger
  | DateApproachingTrigger
  | ManualTrigger;

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

  switch (trigger.frequency) {
    case "minutely":
      // Run every minute
      return true;

    case "hourly":
      // Run at the specified minute of each hour
      if (trigger.minute !== undefined) {
        return minute === trigger.minute;
      }
      return minute === 0; // Default to top of the hour

    case "daily":
      // Run at the specified time each day
      if (trigger.time) {
        const [triggerHour, triggerMinute] = trigger.time.split(":").map(Number);
        return hour === triggerHour && minute === triggerMinute;
      }
      return false; // No time specified

    case "weekly":
      // Run on specified day of week at specified time
      if (trigger.dayOfWeek !== undefined) {
        if (dayOfWeek !== trigger.dayOfWeek) return false;
        if (trigger.time) {
          const [triggerHour, triggerMinute] = trigger.time.split(":").map(Number);
          return hour === triggerHour && minute === triggerMinute;
        }
        return true; // Day matches, no time specified
      }
      return false;

    case "monthly":
      // Run on specified day of month at specified time
      if (trigger.dayOfMonth !== undefined) {
        if (dayOfMonth !== trigger.dayOfMonth) return false;
        if (trigger.time) {
          const [triggerHour, triggerMinute] = trigger.time.split(":").map(Number);
          return hour === triggerHour && minute === triggerMinute;
        }
        return true; // Day matches, no time specified
      }
      return false;

    default:
      return false;
  }
}

/**
 * Check if a record created trigger should run
 */
export function shouldRunRecordCreatedTrigger(
  trigger: RecordCreatedTrigger,
  record: any
): boolean {
  // This is typically called when a record is created
  // The record should match the table
  return true; // If we're checking this, the record was just created
}

/**
 * Check if a record updated trigger should run
 */
export function shouldRunRecordUpdatedTrigger(
  trigger: RecordUpdatedTrigger,
  oldRecord: any,
  newRecord: any
): boolean {
  // If specific fields are specified, only trigger if those fields changed
  if (trigger.fields && trigger.fields.length > 0) {
    return trigger.fields.some((field) => oldRecord[field] !== newRecord[field]);
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
  const fieldValue = record[trigger.field];

  switch (trigger.operator) {
    case "equals":
      return fieldValue === trigger.value;
    case "not_equals":
      return fieldValue !== trigger.value;
    case "contains":
      return String(fieldValue || "").includes(String(trigger.value || ""));
    case ">":
      return Number(fieldValue) > Number(trigger.value);
    case "<":
      return Number(fieldValue) < Number(trigger.value);
    case ">=":
      return Number(fieldValue) >= Number(trigger.value);
    case "<=":
      return Number(fieldValue) <= Number(trigger.value);
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
  const dateValue = record[trigger.dateField];
  if (!dateValue) return false;

  const targetDate = new Date(dateValue);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  targetDate.setHours(0, 0, 0, 0);

  const diffTime = targetDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  // Trigger if the date is exactly X days away
  return diffDays === trigger.daysBefore;
}

/**
 * Check if a manual trigger should run
 */
export function shouldRunManualTrigger(trigger: ManualTrigger): boolean {
  // Manual triggers are always true when explicitly called
  return true;
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
      return shouldRunManualTrigger(trigger);

    default:
      console.warn(`Unknown trigger type: ${(trigger as any).type}`);
      return false;
  }
}

