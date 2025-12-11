/**
 * Logger helper for Automations Suite
 * Writes execution logs to the automation_logs table
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { AutomationLogInsert } from "@/types/database";

/**
 * Write an automation log entry to the database
 */
export async function writeAutomationLog(
  supabase: SupabaseClient,
  automationId: string,
  status: 'success' | 'error',
  input?: any,
  output?: any,
  error?: string,
  durationMs?: number
): Promise<void> {
  try {
    const logEntry: AutomationLogInsert = {
      automation_id: automationId,
      status,
      input: input || null,
      output: output || null,
      error: error || undefined,
      duration_ms: durationMs || undefined,
    };

    const { error: insertError } = await supabase
      .from("automation_logs")
      .insert(logEntry);

    if (insertError) {
      console.error("Failed to write automation log:", insertError);
      // Don't throw - logging failures shouldn't break automation execution
    }
  } catch (err: any) {
    console.error("Error writing automation log:", err);
    // Don't throw - logging failures shouldn't break automation execution
  }
}
