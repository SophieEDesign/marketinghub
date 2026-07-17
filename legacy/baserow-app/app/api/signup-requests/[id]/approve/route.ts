import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { isAdmin } from "@/lib/roles"
import { inviteUserByEmail } from "@/lib/users/invite-user"
import type { InviteRole } from "@/lib/users/invite-user"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await isAdmin()
    if (!admin) {
      return NextResponse.json(
        { error: "Unauthorized: Admin access required" },
        { status: 403 }
      )
    }

    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const role: InviteRole = body.role === "admin" ? "admin" : "member"

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const { data: signupRequest, error: fetchError } = await supabase
      .from("signup_requests")
      .select("*")
      .eq("id", id)
      .maybeSingle()

    if (fetchError || !signupRequest) {
      return NextResponse.json({ error: "Access request not found" }, { status: 404 })
    }

    if (signupRequest.status !== "pending") {
      return NextResponse.json(
        { error: `Request already ${signupRequest.status}` },
        { status: 400 }
      )
    }

    let adminClient
    try {
      adminClient = createAdminClient()
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Server configuration error"
      return NextResponse.json({ error: message }, { status: 500 })
    }

    const inviteResult = await inviteUserByEmail(
      adminClient,
      signupRequest.email,
      role
    )

    if (!inviteResult.ok) {
      return NextResponse.json(
        { error: inviteResult.error || "Failed to send invitation" },
        { status: 400 }
      )
    }

    const { error: updateError } = await supabase
      .from("signup_requests")
      .update({
        status: "approved",
        reviewed_at: new Date().toISOString(),
        reviewed_by: user?.id ?? null,
      })
      .eq("id", id)

    if (updateError) {
      console.error("signup_requests approve update error:", updateError)
    }

    return NextResponse.json({
      message: `Invitation sent to ${signupRequest.email}`,
      email: signupRequest.email,
      role,
    })
  } catch (error: unknown) {
    console.error("approve signup-request error:", error)
    return NextResponse.json(
      { error: "Failed to approve access request" },
      { status: 500 }
    )
  }
}
