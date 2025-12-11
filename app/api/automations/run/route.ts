/**
 * API Route: /api/automations/run
 * 
 * Backend automation runner endpoint
 * Loads active automations, evaluates triggers, conditions, and executes actions
 * 
 * This endpoint is designed to be called by:
 * - Vercel Cron Jobs (for scheduled automations)
 * - Manual triggers (via UI or API)
 * - Webhook triggers (when records are created/updated)
 */

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import { Automation } from "@/lib/types/automations";
import { evaluateTrigger } from "@/lib/automations/triggerEngine";
import { evaluateConditions } from "@/lib/automations/conditionEngine";
import { executeActions, ActionContext } from "@/lib/automations/actionEngine";
import { writeAutomationLog } from "@/lib/automations/logger";
import { AutomationTrigger } from "@/lib/automations/schema";

export const dynamic = 'force-dynamic';

interface RunResult {
  automationId: string;
  automationName: string;
  success: boolean;
  error?: string;
  durationMs: number;
}

interface RunSummary {
  runCount: number;
  successCount: number;
  errorCount: number;
  logs: RunResult[];
}

/**
 * POST /api/automations/run
 * 
 * Runs all active automations (or specific automation if automationId provided)
 * 
 * Query params:
 * - automationId (optional): Run only this specific automation
 * - triggerType (optional): Only run automations with this trigger type
 * - recordId (optional): For record-based triggers, the record ID
 * - tableId (optional): For record-based triggers, the table ID
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const results: RunResult[] = [];
  let runCount = 0;
  let successCount = 0;
  let errorCount = 0;

  try {
    // Parse request body for optional parameters
    const body = await request.json().catch(() => ({}));
    const { automationId, triggerType, recordId, tableId, oldRecord, newRecord } = body;

    // Load active automations
    let query = supabase
      .from("automations")
      .select("*")
      .eq("status", "active");

    // Filter by automation ID if provided
    if (automationId) {
      query = query.eq("id", automationId);
    }

    const { data: automations, error: fetchError } = await query;

    if (fetchError) {
      console.error("Error fetching automations:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch automations", details: fetchError.message },
        { status: 500 }
      );
    }

    if (!automations || automations.length === 0) {
      return NextResponse.json({
        runCount: 0,
        successCount: 0,
        errorCount: 0,
        logs: [],
        message: "No active automations found",
      });
    }

    // Process each automation
    for (const automation of automations) {
      const automationStartTime = Date.now();
      runCount++;

      try {
        const trigger = automation.trigger as AutomationTrigger;

        // Skip manual triggers unless explicitly requested
        if (trigger.type === "manual" && !automationId) {
          continue;
        }

        // Filter by trigger type if provided
        if (triggerType && trigger.type !== triggerType) {
          continue;
        }

        // Evaluate trigger
        let shouldRun = false;
        let record: any = null;

        if (trigger.type === "schedule") {
          // For schedule triggers, evaluate based on current time
          shouldRun = evaluateTrigger(trigger, { now: new Date() });
        } else if (trigger.type === "record_created" || trigger.type === "record_updated" || trigger.type === "field_match" || trigger.type === "date_approaching") {
          // For record-based triggers, we need to fetch records
          if (recordId && tableId) {
            // Resolve table name from table_id
            const { data: table } = await supabase
              .from("tables")
              .select("name")
              .eq("id", tableId)
              .single();

            if (table) {
              // Fetch the record
              const { data: fetchedRecord, error: recordError } = await supabase
                .from(table.name)
                .select("*")
                .eq("id", recordId)
                .single();

              if (!recordError && fetchedRecord) {
                record = fetchedRecord;
                
                // Evaluate trigger with record context
                if (trigger.type === "record_created") {
                  shouldRun = evaluateTrigger(trigger, { record });
                } else if (trigger.type === "record_updated") {
                  shouldRun = evaluateTrigger(trigger, {
                    oldRecord: oldRecord || {},
                    newRecord: newRecord || record,
                  });
                } else if (trigger.type === "field_match" || trigger.type === "date_approaching") {
                  shouldRun = evaluateTrigger(trigger, { record });
                }
              }
            }
          } else {
            // For scheduled runs, we might need to query for matching records
            // This is more complex and would require table-specific queries
            // For now, skip record-based triggers if no record context provided
            continue;
          }
        } else {
          // Other trigger types
          shouldRun = evaluateTrigger(trigger, { now: new Date() });
        }

        // If trigger criteria NOT met, skip safely
        if (!shouldRun) {
          continue;
        }

        // Evaluate conditions
        const conditionsPass = evaluateConditions(
          automation.conditions || [],
          record || {}
        );

        if (!conditionsPass) {
          // Conditions not met - log but don't count as error
          await writeAutomationLog(
            supabase,
            automation.id,
            "success",
            { trigger, record, conditions: automation.conditions },
            { message: "Conditions not met, automation skipped" },
            undefined,
            Date.now() - automationStartTime
          );
          continue;
        }

        // Execute actions
        const automationData: Automation = {
          id: automation.id,
          name: automation.name,
          status: automation.status as 'active' | 'paused',
          trigger: automation.trigger,
          conditions: automation.conditions || [],
          actions: automation.actions || [],
          created_at: automation.created_at,
          updated_at: automation.updated_at,
        };

        const actionContext: ActionContext = {
          record: record || {},
          oldRecord,
          newRecord,
          automation: automationData,
          supabase,
          logger: (message, data) => {
            console.log(`[Automation ${automation.name}]`, message, data);
          },
        };

        const actionResults = await executeActions(
          automation.actions || [],
          actionContext
        );

        // Check if all actions succeeded
        const allActionsSucceeded = actionResults.every((r) => r.success);
        const hasErrors = actionResults.some((r) => !r.success);
        const errors = actionResults
          .filter((r) => !r.success)
          .map((r) => r.error)
          .join("; ");

        const durationMs = Date.now() - automationStartTime;

        // Write log entry
        await writeAutomationLog(
          supabase,
          automation.id,
          allActionsSucceeded ? "success" : "error",
          { trigger, record, conditions: automation.conditions },
          { actionResults },
          hasErrors ? errors : undefined,
          durationMs
        );

        // Record result
        if (allActionsSucceeded) {
          successCount++;
          results.push({
            automationId: automation.id,
            automationName: automation.name,
            success: true,
            durationMs,
          });
        } else {
          errorCount++;
          results.push({
            automationId: automation.id,
            automationName: automation.name,
            success: false,
            error: errors,
            durationMs,
          });
        }
      } catch (error: any) {
        // Handle errors gracefully - log but don't throw globally
        errorCount++;
        const durationMs = Date.now() - automationStartTime;

        await writeAutomationLog(
          supabase,
          automation.id,
          "error",
          { trigger: automation.trigger },
          undefined,
          error.message || "Unknown error",
          durationMs
        );

        results.push({
          automationId: automation.id,
          automationName: automation.name,
          success: false,
          error: error.message || "Unknown error",
          durationMs,
        });

        console.error(`Error running automation ${automation.name}:`, error);
      }
    }

    const summary: RunSummary = {
      runCount,
      successCount,
      errorCount,
      logs: results,
    };

    return NextResponse.json(summary);
  } catch (error: any) {
    console.error("Fatal error in automation runner:", error);
    return NextResponse.json(
      {
        runCount,
        successCount,
        errorCount,
        logs: results,
        error: error.message || "Fatal error in automation runner",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/automations/run
 * 
 * Health check endpoint - returns status without running automations
 */
export async function GET() {
  try {
    const { count, error } = await supabase
      .from("automations")
      .select("*", { count: "exact", head: true })
      .eq("status", "active");

    if (error) {
      return NextResponse.json(
        { error: "Failed to check automations", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      status: "ok",
      activeAutomations: count || 0,
      message: "Automation runner is ready. Use POST to run automations.",
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
