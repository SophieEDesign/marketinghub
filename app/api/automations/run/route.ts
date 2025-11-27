import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { evaluateTrigger } from "@/lib/automations/triggerEngine";
import { evaluateConditions } from "@/lib/automations/conditionEngine";
import { executeActions } from "@/lib/automations/actionEngine";
import { AutomationTrigger } from "@/lib/automations/triggerEngine";
import { Condition } from "@/lib/automations/conditionEngine";
import { AutomationAction } from "@/lib/automations/actionEngine";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Rate limiting: track last run time per automation
const lastRunTimes = new Map<string, number>();
const MIN_RUN_INTERVAL_MS = 60 * 1000; // 1 minute minimum between runs

export const dynamic = 'force-dynamic';

/**
 * POST /api/automations/run
 * Runs all active automations or a specific automation
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { automationId, record, oldRecord, newRecord } = body;

    // Load active automations
    let query = supabaseAdmin
      .from("automations")
      .select("*")
      .eq("status", "active");

    if (automationId) {
      query = query.eq("id", automationId);
    }

    const { data: automations, error: fetchError } = await query;

    if (fetchError) {
      console.error("[Automations] Error fetching automations:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch automations", details: fetchError.message },
        { status: 500 }
      );
    }

    if (!automations || automations.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No active automations to run",
        results: [],
      });
    }

    const results: Array<{
      automationId: string;
      automationName: string;
      triggered: boolean;
      executed: boolean;
      error?: string;
      actionsExecuted: number;
    }> = [];

    // Process each automation
    for (const automation of automations) {
      const automationId = automation.id;
      const automationName = automation.name;

      // Rate limiting check
      const lastRun = lastRunTimes.get(automationId);
      const now = Date.now();
      if (lastRun && now - lastRun < MIN_RUN_INTERVAL_MS) {
        results.push({
          automationId,
          automationName,
          triggered: false,
          executed: false,
          error: "Rate limited (min 1 minute between runs)",
          actionsExecuted: 0,
        });
        continue;
      }

      try {
        // Evaluate trigger
        const trigger = automation.trigger as AutomationTrigger;
        const triggerContext = {
          now: new Date(),
          record,
          oldRecord,
          newRecord,
        };

        const shouldTrigger = evaluateTrigger(trigger, triggerContext);

        if (!shouldTrigger) {
          results.push({
            automationId,
            automationName,
            triggered: false,
            executed: false,
            actionsExecuted: 0,
          });
          continue;
        }

        // Evaluate conditions
        const conditions = (automation.conditions || []) as Condition[];
        const recordToCheck = newRecord || record;

        if (recordToCheck && !evaluateConditions(conditions, recordToCheck, oldRecord)) {
          results.push({
            automationId,
            automationName,
            triggered: true,
            executed: false,
            error: "Conditions not met",
            actionsExecuted: 0,
          });
          continue;
        }

        // Execute actions
        const actions = automation.actions as AutomationAction[];
        const startTime = Date.now();

        const actionResults = await executeActions(actions, {
          record: recordToCheck,
          oldRecord,
          newRecord,
          automation: {
            id: automation.id,
            name: automation.name,
          },
        });

        const duration = Date.now() - startTime;
        const successCount = actionResults.filter((r) => r.success).length;
        const hasErrors = actionResults.some((r) => !r.success);

        // Log the execution
        const logStatus = hasErrors ? "error" : "success";
        const logError = hasErrors
          ? actionResults
              .filter((r) => !r.success)
              .map((r) => r.error)
              .join("; ")
          : null;

        await supabaseAdmin.from("automation_logs").insert({
          automation_id: automationId,
          status: logStatus,
          input: {
            trigger,
            conditions,
            record: recordToCheck,
          },
          output: {
            actionsExecuted: actionResults.length,
            successCount,
            results: actionResults,
          },
          error: logError,
          duration_ms: duration,
        });

        // Update last run time
        lastRunTimes.set(automationId, now);

        results.push({
          automationId,
          automationName,
          triggered: true,
          executed: true,
          actionsExecuted: successCount,
          error: logError || undefined,
        });
      } catch (error: any) {
        console.error(`[Automations] Error running automation ${automationId}:`, error);

        // Log the error
        await supabaseAdmin.from("automation_logs").insert({
          automation_id: automationId,
          status: "error",
          input: {
            trigger: automation.trigger,
            conditions: automation.conditions,
            record,
          },
          error: error.message || "Unknown error",
          duration_ms: 0,
        });

        results.push({
          automationId,
          automationName,
          triggered: true,
          executed: false,
          error: error.message || "Execution failed",
          actionsExecuted: 0,
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${automations.length} automation(s)`,
      results,
    });
  } catch (error: any) {
    console.error("[Automations] Exception in POST /api/automations/run:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/automations/run
 * Manual trigger endpoint (for testing)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const automationId = searchParams.get("id");

    // Call POST handler with automation ID
    const mockRequest = new NextRequest(request.url, {
      method: "POST",
      body: JSON.stringify({ automationId }),
      headers: request.headers,
    });

    return POST(mockRequest);
  } catch (error: any) {
    console.error("[Automations] Exception in GET /api/automations/run:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

