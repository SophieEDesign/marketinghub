import { NextRequest, NextResponse } from "next/server";
import { Automation } from "@/lib/types/automations";
import { evaluateTrigger } from "@/lib/automations/triggerEngine";
import { evaluateConditions } from "@/lib/automations/conditionEngine";
import { AutomationTrigger } from "@/lib/automations/schema";

export const dynamic = "force-dynamic";

interface TestRequest {
  automation: Partial<Automation>;
  sampleRecord?: any;
  forceTrigger?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const body: TestRequest = await request.json();
    const { automation, sampleRecord, forceTrigger = false } = body;

    if (!automation) {
      return NextResponse.json(
        { error: "Automation data is required" },
        { status: 400 }
      );
    }

    const results: any = {
      triggerMatched: false,
      conditionsPassed: false,
      actionResults: [],
      logs: [],
      errors: [],
    };

    // Test trigger evaluation
    try {
      if (forceTrigger || !automation.trigger) {
        results.triggerMatched = true;
        results.logs.push({
          type: "info",
          message: forceTrigger
            ? "Trigger forced to match for testing"
            : "No trigger specified, assuming match",
        });
      } else {
        const trigger = automation.trigger as AutomationTrigger;
        const now = new Date();

        // For test mode, we evaluate triggers differently
        if (trigger.type === "schedule") {
          // In test mode, we'll simulate that schedule triggers match
          results.triggerMatched = true;
          results.logs.push({
            type: "info",
            message: "Schedule trigger would match at configured time",
          });
        } else if (
          trigger.type === "record_created" ||
          trigger.type === "record_updated" ||
          trigger.type === "field_match" ||
          trigger.type === "date_approaching"
        ) {
          if (sampleRecord) {
            // Evaluate trigger with sample record
            const context: any = {
              record: sampleRecord,
              now,
            };
            if (trigger.type === "record_updated") {
              // For updated triggers, we simulate old/new records
              context.oldRecord = { ...sampleRecord, status: "old" };
              context.newRecord = sampleRecord;
            }
            const triggerResult = evaluateTrigger(trigger, context);
            results.triggerMatched = triggerResult;
            results.logs.push({
              type: triggerResult ? "success" : "info",
              message: triggerResult
                ? "Trigger matched with sample record"
                : "Trigger did not match with sample record",
            });
          } else {
            results.errors.push(
              "Sample record required for record-based triggers"
            );
            results.triggerMatched = false;
          }
        } else if (trigger.type === "manual") {
          results.triggerMatched = true;
          results.logs.push({
            type: "info",
            message: "Manual trigger always matches in test mode",
          });
        }
      }
    } catch (error: any) {
      results.errors.push(`Trigger evaluation error: ${error.message}`);
      results.logs.push({
        type: "error",
        message: `Trigger evaluation failed: ${error.message}`,
      });
    }

    // Test conditions evaluation
    if (results.triggerMatched && automation.conditions) {
      try {
        if (sampleRecord) {
          const conditionsPassed = evaluateConditions(
            automation.conditions,
            sampleRecord
          );
          results.conditionsPassed = conditionsPassed;
          results.logs.push({
            type: conditionsPassed ? "success" : "warning",
            message: conditionsPassed
              ? "All conditions passed"
              : "Some conditions did not pass",
          });
        } else if (automation.conditions.length === 0) {
          results.conditionsPassed = true;
          results.logs.push({
            type: "info",
            message: "No conditions specified, always passes",
          });
        } else {
          results.errors.push(
            "Sample record required to evaluate conditions"
          );
          results.conditionsPassed = false;
        }
      } catch (error: any) {
        results.errors.push(`Condition evaluation error: ${error.message}`);
        results.logs.push({
          type: "error",
          message: `Condition evaluation failed: ${error.message}`,
        });
      }
    } else if (results.triggerMatched && (!automation.conditions || automation.conditions.length === 0)) {
      results.conditionsPassed = true;
      results.logs.push({
        type: "info",
        message: "No conditions specified, always passes",
      });
    }

    // Simulate action execution (sandbox mode)
    if (results.triggerMatched && results.conditionsPassed && automation.actions) {
      for (let i = 0; i < automation.actions.length; i++) {
        const action = automation.actions[i];
        try {
          const actionResult = await simulateAction(action, sampleRecord, i);
          results.actionResults.push(actionResult);
          results.logs.push({
            type: actionResult.success ? "success" : "error",
            message: `Action ${i + 1} (${action.type}): ${
              actionResult.success ? "Simulated successfully" : actionResult.error
            }`,
          });
        } catch (error: any) {
          results.actionResults.push({
            success: false,
            error: error.message,
            actionIndex: i,
            actionType: action.type,
          });
          results.errors.push(`Action ${i + 1} error: ${error.message}`);
        }
      }
    }

    return NextResponse.json(results);
  } catch (error: any) {
    console.error("Test automation error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to test automation" },
      { status: 500 }
    );
  }
}

async function simulateAction(
  action: any,
  sampleRecord: any,
  index: number
): Promise<any> {
  const result: any = {
    success: true,
    actionIndex: index,
    actionType: action.type,
    simulated: true,
    output: {},
  };

  switch (action.type) {
    case "send_email":
      result.output = {
        simulated: true,
        to: action.to,
        subject: action.subject,
        body: action.body,
        message: "Email would be sent (simulated)",
      };
      break;

    case "send_webhook":
      result.output = {
        simulated: true,
        url: action.url,
        method: action.method || "POST",
        payload: action.body,
        message: "Webhook would be called (simulated)",
      };
      break;

    case "update_record":
      result.output = {
        simulated: true,
        table: action.table_id || action.table_name,
        recordId: action.record_id || sampleRecord?.id || "{{record.id}}",
        updates: action.field_updates,
        message: "Record would be updated (simulated)",
      };
      break;

    case "create_record":
      result.output = {
        simulated: true,
        table: action.table_id || action.table_name,
        data: action.field_values,
        message: "Record would be created (simulated)",
      };
      break;

    case "delete_record":
      result.output = {
        simulated: true,
        table: action.table_id || action.table_name,
        recordId: action.record_id || sampleRecord?.id || "{{record.id}}",
        message: "Record would be deleted (simulated)",
      };
      break;

    case "set_field_value":
      result.output = {
        simulated: true,
        fieldKey: action.field_key,
        value: action.value,
        message: "Field value would be set (simulated)",
      };
      break;

    default:
      result.success = false;
      result.error = `Unknown action type: ${action.type}`;
  }

  return result;
}
