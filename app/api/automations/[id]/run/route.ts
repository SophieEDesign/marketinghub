import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { evaluateTrigger } from "@/lib/automations/triggerEngine";
import { evaluateConditions } from "@/lib/automations/conditionEngine";
import { executeActions } from "@/lib/automations/actionEngine";
import { AutomationTrigger, Condition, AutomationAction } from "@/lib/automations/schema";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export const dynamic = 'force-dynamic';

/**
 * POST /api/automations/[id]/run
 * Manually trigger a specific automation
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json().catch(() => ({}));
    const { record, oldRecord, newRecord } = body;

    // Get the automation
    const { data: automation, error: fetchError } = await supabaseAdmin
      .from("automations")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !automation) {
      return NextResponse.json(
        { error: "Automation not found" },
        { status: 404 }
      );
    }

    if (automation.status !== "active") {
      return NextResponse.json(
        { error: "Automation is not active" },
        { status: 400 }
      );
    }

    // Evaluate trigger (for manual triggers, this should always be true)
    const trigger = automation.trigger as AutomationTrigger;
    const triggerContext = {
      now: new Date(),
      record,
      oldRecord,
      newRecord,
    };

    const shouldTrigger = evaluateTrigger(trigger, triggerContext);

    if (!shouldTrigger) {
      return NextResponse.json({
        success: false,
        message: "Trigger conditions not met",
      });
    }

    // Evaluate conditions
    const conditions = (automation.conditions || []) as Condition[];
    const recordToCheck = newRecord || record;

    if (recordToCheck && !evaluateConditions(conditions, recordToCheck, oldRecord)) {
      return NextResponse.json({
        success: false,
        message: "Conditions not met",
      });
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
      automation_id: id,
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

    return NextResponse.json({
      success: true,
      message: `Executed ${successCount}/${actionResults.length} actions`,
      results: actionResults,
      duration_ms: duration,
    });
  } catch (error: any) {
    console.error(`[Automations] Error running automation ${params.id}:`, error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

