import { Resend } from "resend"

export interface MentionNotificationParams {
  toEmail: string
  commentAuthorName: string
  recordUrl: string
  commentPreview: string
  tableName: string
}

/**
 * Send email notification when a user is @mentioned in a record comment.
 * Fails gracefully if RESEND_API_KEY is missing or send fails.
 */
export async function sendMentionNotification(
  params: MentionNotificationParams
): Promise<{ success: boolean; error?: string }> {
  const { toEmail, commentAuthorName, recordUrl, commentPreview, tableName } = params

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey?.trim()) {
    console.warn("[sendMentionNotification] RESEND_API_KEY not set, skipping email")
    return { success: false, error: "Email not configured" }
  }

  const fromEmail =
    process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev"

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <p><strong>${escapeHtml(commentAuthorName)}</strong> mentioned you in a comment on <strong>${escapeHtml(tableName)}</strong>:</p>
  <blockquote style="border-left: 4px solid #ddd; margin: 16px 0; padding: 12px 16px; background: #f9f9f9;">
    ${escapeHtml(commentPreview)}
  </blockquote>
  <p><a href="${escapeHtml(recordUrl)}" style="color: #2563eb; text-decoration: none;">View record →</a></p>
  <p style="color: #666; font-size: 12px;">This is an automated notification from Marketing Hub.</p>
</body>
</html>
`.trim()

  try {
    const resend = new Resend(apiKey.trim())
    const { error } = await resend.emails.send({
      from: fromEmail,
      to: toEmail,
      subject: `${commentAuthorName} mentioned you in a comment`,
      html,
    })

    if (error) {
      console.error("[sendMentionNotification] Resend error:", error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (err: unknown) {
    const msg = (err as { message?: string })?.message || "Unknown error"
    console.error("[sendMentionNotification] Failed:", err)
    return { success: false, error: msg }
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}
