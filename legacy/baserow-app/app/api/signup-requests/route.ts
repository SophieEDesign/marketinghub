import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { isAdmin } from "@/lib/roles"
import { getAuthRateLimiter } from "@/lib/rate-limit"
import { getRequestIp } from "@/lib/request-ip"
import { authEmailExists } from "@/lib/users/auth-email-exists"

const MAX_BODY_SIZE = 1024 * 10

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Public: submit an access request */
export async function POST(request: NextRequest) {
  try {
    const authLimiter = getAuthRateLimiter()
    if (authLimiter) {
      const ip = getRequestIp(request)
      const { success } = await authLimiter.limit(`signup-request:${ip}`)
      if (!success) {
        return NextResponse.json(
          { error: "Too many requests. Please try again later." },
          { status: 429 }
        )
      }
    }

    const contentLength = parseInt(request.headers.get("content-length") || "0", 10)
    if (contentLength > MAX_BODY_SIZE) {
      return NextResponse.json({ error: "Request body too large" }, { status: 413 })
    }

    const body = await request.json()
    const email = typeof body.email === "string" ? body.email.trim() : ""
    const name =
      typeof body.name === "string" && body.name.trim() ? body.name.trim() : null

    if (!email || !EMAIL_REGEX.test(email)) {
      return NextResponse.json({ error: "A valid email is required" }, { status: 400 })
    }

    let adminClient
    try {
      adminClient = createAdminClient()
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Server configuration error"
      return NextResponse.json({ error: message }, { status: 500 })
    }

    if (await authEmailExists(adminClient, email)) {
      return NextResponse.json(
        {
          error:
            "An account already exists for this email. Try signing in or ask your admin for a new invite.",
        },
        { status: 400 }
      )
    }

    const { data: existing } = await adminClient
      .from("signup_requests")
      .select("id")
      .eq("status", "pending")
      .ilike("email", email)
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        {
          message:
            "Your request is already pending. An administrator will email you when approved.",
        },
        { status: 200 }
      )
    }

    const { error: insertError } = await adminClient.from("signup_requests").insert({
      email,
      name,
      status: "pending",
    })

    if (insertError) {
      console.error("signup_requests insert error:", insertError)
      return NextResponse.json(
        { error: "Could not submit your request. Please try again." },
        { status: 500 }
      )
    }

    return NextResponse.json({
      message:
        "Request submitted. An administrator will review your request and send an invite email if approved.",
    })
  } catch (error: unknown) {
    console.error("POST signup-requests error:", error)
    return NextResponse.json(
      { error: "Failed to submit access request" },
      { status: 500 }
    )
  }
}

/** Admin: list access requests (default: pending only) */
export async function GET(request: NextRequest) {
  try {
    const admin = await isAdmin()
    if (!admin) {
      return NextResponse.json(
        { error: "Unauthorized: Admin access required" },
        { status: 403 }
      )
    }

    const status = request.nextUrl.searchParams.get("status") || "pending"
    const supabase = await createClient()

    let query = supabase
      .from("signup_requests")
      .select("id, email, name, status, requested_at, reviewed_at, reviewed_by")
      .order("requested_at", { ascending: false })

    if (status !== "all") {
      query = query.eq("status", status)
    }

    const { data, error } = await query

    if (error) {
      console.error("signup_requests list error:", error)
      return NextResponse.json({ requests: [] })
    }

    return NextResponse.json({ requests: data ?? [] })
  } catch (error: unknown) {
    console.error("GET signup-requests error:", error)
    return NextResponse.json({ requests: [] })
  }
}
