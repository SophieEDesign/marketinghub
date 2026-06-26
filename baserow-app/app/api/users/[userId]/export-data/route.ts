import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireAdmin } from "@/lib/api/authz"

/**
 * GET /api/users/[userId]/export-data
 * Admin-only: export a user's profile, comments, and activity references (GDPR access/portability aid).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { admin, response } = await requireAdmin()
  if (!admin) return response

  const { userId } = await params

  try {
    const supabase = await createClient()
    const adminClient = createAdminClient()

    const [
      profileResult,
      authUserResult,
      commentsResult,
      mentionsResult,
      activityResult,
    ] = await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
      adminClient.auth.admin.getUserById(userId),
      supabase
        .from("record_comments")
        .select("id, table_id, record_id, body, created_at, updated_at")
        .eq("user_id", userId),
      supabase
        .from("comment_mentions")
        .select("id, comment_id, created_at")
        .eq("mentioned_user_id", userId),
      supabase
        .from("entity_activity_log")
        .select("id, entity_type, entity_id, action, metadata, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(500),
    ])

    if (authUserResult.error) {
      return NextResponse.json({ error: authUserResult.error.message }, { status: 404 })
    }

    const exportPayload = {
      exported_at: new Date().toISOString(),
      user_id: userId,
      auth: {
        email: authUserResult.data.user?.email ?? null,
        created_at: authUserResult.data.user?.created_at ?? null,
        last_sign_in_at: authUserResult.data.user?.last_sign_in_at ?? null,
      },
      profile: profileResult.data ?? null,
      record_comments: commentsResult.data ?? [],
      comment_mentions_received: mentionsResult.data ?? [],
      entity_activity_log: activityResult.data ?? [],
    }

    return NextResponse.json(exportPayload, {
      headers: {
        "Content-Disposition": `attachment; filename="user-${userId}-export.json"`,
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Export failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
