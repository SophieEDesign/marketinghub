import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireAdmin } from "@/lib/api/authz"

const SIGNUP_REQUEST_RETENTION_DAYS = 180
const AUTOMATION_LOG_RETENTION_DAYS = 90

/**
 * POST /api/admin/data-retention
 * Admin-only: purge old signup_requests and automation_logs.
 * Can also be invoked by cron with CRON_SECRET (same pattern as run-scheduled).
 */
export async function POST(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET?.trim()
  const authHeader = request.headers.get("authorization")
  const cronAuthorized =
    cronSecret &&
    authHeader === `Bearer ${cronSecret}` &&
    process.env.NODE_ENV === "production"

  if (!cronAuthorized) {
    const { admin, response } = await requireAdmin()
    if (!admin) return response
  }

  try {
    const adminClient = createAdminClient()
    const now = Date.now()
    const signupCutoff = new Date(
      now - SIGNUP_REQUEST_RETENTION_DAYS * 24 * 60 * 60 * 1000
    ).toISOString()
    const logCutoff = new Date(
      now - AUTOMATION_LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000
    ).toISOString()

    const [signupResult, logsResult] = await Promise.all([
      adminClient
        .from("signup_requests")
        .delete()
        .lt("created_at", signupCutoff)
        .in("status", ["approved", "rejected"]),
      adminClient.from("automation_logs").delete().lt("created_at", logCutoff),
    ])

    if (signupResult.error) {
      return NextResponse.json({ error: signupResult.error.message }, { status: 500 })
    }
    if (logsResult.error) {
      return NextResponse.json({ error: logsResult.error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      signup_requests_cutoff: signupCutoff,
      automation_logs_cutoff: logCutoff,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Retention job failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
