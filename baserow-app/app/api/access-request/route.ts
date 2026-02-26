import { NextRequest, NextResponse } from "next/server"
import { Resend } from "resend"

const TO_EMAIL = "marketing@petersandmay.com"

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, email, details } = body

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 })
    }
    if (!email || typeof email !== "string" || !email.trim()) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 })
    }

    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey?.trim()) {
      console.warn("[access-request] RESEND_API_KEY not set")
      return NextResponse.json(
        { error: "Email service is not configured. Please try again later." },
        { status: 503 }
      )
    }

    const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev"

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="margin-top: 0;">Marketing Hub – Access Request</h2>
  <p><strong>Name:</strong> ${escapeHtml(name.trim())}</p>
  <p><strong>Email:</strong> ${escapeHtml(email.trim())}</p>
  ${details ? `<p><strong>Details:</strong></p><p style="white-space: pre-wrap;">${escapeHtml(details.trim())}</p>` : ""}
  <p style="color: #666; font-size: 12px; margin-top: 24px;">This request was submitted from the Marketing Hub login page.</p>
</body>
</html>
`.trim()

    const resend = new Resend(apiKey.trim())
    const { error } = await resend.emails.send({
      from: fromEmail,
      to: TO_EMAIL,
      replyTo: email.trim(),
      subject: `Marketing Hub access request from ${escapeHtml(name.trim())}`,
      html,
    })

    if (error) {
      console.error("[access-request] Resend error:", error)
      return NextResponse.json(
        { error: "Failed to send request. Please try again." },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[access-request] Failed:", err)
    return NextResponse.json(
      { error: "Failed to send request. Please try again." },
      { status: 500 }
    )
  }
}
