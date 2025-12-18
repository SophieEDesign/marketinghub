import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { executeAutomation } from "@/lib/automations/engine"
import type { Automation } from "@/types/database"

/**
 * Test endpoint for running an automation with sample data
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { automationId: string } }
) {
  try {
    const supabase = await createClient()

    // Load automation
    const { data: automation, error } = await supabase
      .from("automations")
      .select("*")
      .eq("id", params.automationId)
      .single()

    if (error || !automation) {
      return NextResponse.json(
        { success: false, error: "Automation not found" },
        { status: 404 }
      )
    }

    // Execute with sample data
    const result = await executeAutomation(automation as Automation, {
      record: {
        id: "test-record-id",
        name: "Test Record",
        created_at: new Date().toISOString(),
      },
    })

    return NextResponse.json({
      success: result.success,
      run_id: result.runId,
      error: result.error,
      logs: result.logs,
    })
  } catch (error: any) {
    console.error("Error testing automation:", error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to test automation",
      },
      { status: 500 }
    )
  }
}
