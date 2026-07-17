import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { isAdmin } from "@/lib/roles"

export async function POST(
  _request: NextRequest,
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
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const { data: signupRequest, error: fetchError } = await supabase
      .from("signup_requests")
      .select("id, status")
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

    const { error: updateError } = await supabase
      .from("signup_requests")
      .update({
        status: "rejected",
        reviewed_at: new Date().toISOString(),
        reviewed_by: user?.id ?? null,
      })
      .eq("id", id)

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message || "Failed to reject request" },
        { status: 500 }
      )
    }

    return NextResponse.json({ message: "Access request rejected" })
  } catch (error: unknown) {
    console.error("reject signup-request error:", error)
    return NextResponse.json(
      { error: "Failed to reject access request" },
      { status: 500 }
    )
  }
}
