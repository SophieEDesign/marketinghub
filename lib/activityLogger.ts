"use client";

import { supabase } from "./supabaseClient";

export interface ActivityLogEntry {
  table: string;
  recordId: string;
  field?: string;
  oldValue?: any;
  newValue?: any;
  action?: "update" | "create" | "delete" | "automation";
  triggeredBy?: "user" | "automation";
}

/**
 * Log a single activity entry
 */
export async function logActivity({
  table,
  recordId,
  field,
  oldValue,
  newValue,
  action = "update",
  triggeredBy = "user",
}: ActivityLogEntry): Promise<void> {
  try {
    const { error } = await supabase.from("activity_log").insert({
      table_name: table,
      record_id: recordId,
      field_name: field || null,
      old_value: oldValue !== undefined ? oldValue : null,
      new_value: newValue !== undefined ? newValue : null,
      action,
      triggered_by: triggeredBy,
    });

    if (error) {
      console.error("Error logging activity:", error);
      // Don't throw - logging failures shouldn't break the app
    }
  } catch (err) {
    console.error("Unexpected error in logActivity:", err);
    // Don't throw - logging failures shouldn't break the app
  }
}

/**
 * Log multiple field changes from old record to new record
 */
export async function logFieldChanges(
  oldRecord: any,
  newRecord: any,
  table: string,
  triggeredBy: "user" | "automation" = "user"
): Promise<void> {
  if (!oldRecord || !newRecord || !oldRecord.id || !newRecord.id) {
    return;
  }

  const recordId = newRecord.id;
  const changedFields: Array<{ field: string; oldValue: any; newValue: any }> = [];

  // Compare all fields
  const allKeys = new Set([...Object.keys(oldRecord), ...Object.keys(newRecord)]);
  
  for (const key of allKeys) {
    // Skip internal fields
    if (key === "id" || key === "created_at" || key === "updated_at" || key === "__automated") {
      continue;
    }

    const oldVal = oldRecord[key];
    const newVal = newRecord[key];

    // Deep comparison for arrays and objects
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      changedFields.push({
        field: key,
        oldValue: oldVal,
        newValue: newVal,
      });
    }
  }

  // Log each changed field
  for (const change of changedFields) {
    await logActivity({
      table,
      recordId,
      field: change.field,
      oldValue: change.oldValue,
      newValue: change.newValue,
      action: triggeredBy === "automation" ? "automation" : "update",
      triggeredBy,
    });
  }
}

/**
 * Log record creation
 */
export async function logRecordCreation(
  table: string,
  recordId: string,
  record: any
): Promise<void> {
  await logActivity({
    table,
    recordId,
    action: "create",
    triggeredBy: "user",
    newValue: record,
  });
}

/**
 * Log record deletion
 */
export async function logRecordDeletion(
  table: string,
  recordId: string,
  record: any
): Promise<void> {
  await logActivity({
    table,
    recordId,
    action: "delete",
    triggeredBy: "user",
    oldValue: record,
  });
}

