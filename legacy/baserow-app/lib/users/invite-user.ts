import type { SupabaseClient } from "@supabase/supabase-js"

export type InviteRole = "admin" | "member"

export interface InviteUserResult {
  ok: boolean
  error?: string
  userId?: string
}

/**
 * Send a Supabase invite email and ensure a profile row exists.
 * Used by admin invite and access-request approval flows.
 */
export async function inviteUserByEmail(
  adminClient: SupabaseClient,
  email: string,
  role: InviteRole,
  options?: { default_interface?: string }
): Promise<InviteUserResult> {
  const trimmed = email.trim()
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    "http://localhost:3000"

  const userMetadata: { role: string; default_interface?: string } = { role }
  if (options?.default_interface && options.default_interface !== "__none__") {
    userMetadata.default_interface = options.default_interface
  }

  const { data: inviteData, error: inviteError } =
    await adminClient.auth.admin.inviteUserByEmail(trimmed, {
      data: userMetadata,
      redirectTo: `${baseUrl}/auth/callback`,
    })

  if (inviteError) {
    const msg = inviteError.message || ""
    if (
      msg.includes("already registered") ||
      msg.includes("already exists")
    ) {
      return { ok: false, error: "A user with this email already exists" }
    }
    return { ok: false, error: msg || "Failed to send invitation" }
  }

  if (inviteData?.user?.id) {
    const { error: profileError } = await adminClient.from("profiles").upsert(
      {
        user_id: inviteData.user.id,
        role,
      },
      { onConflict: "user_id" }
    )
    if (profileError) {
      console.error("Error creating profile after invite:", profileError)
    }
    return { ok: true, userId: inviteData.user.id }
  }

  return { ok: true }
}
