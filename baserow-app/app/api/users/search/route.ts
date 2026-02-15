import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { formatUserDisplayName } from "@/lib/users/userDisplay"

/**
 * GET /api/users/search?q=john
 * Search users by email for @mention autocomplete.
 * Authenticated users only. Returns user_id, email, display_name.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const q = request.nextUrl.searchParams.get("q")?.trim() || ""
    if (q.length < 2) {
      return NextResponse.json({ users: [] })
    }

    // Query user_profile_sync_status (has user_id, email; granted to authenticated)
    const { data: rows, error } = await supabase
      .from("user_profile_sync_status")
      .select("user_id, email")
      .ilike("email", `%${q}%`)
      .limit(10)

    if (error) {
      console.warn("User search fallback - user_profile_sync_status:", error)
      return NextResponse.json({ users: [] })
    }

    const users = (rows ?? []).map((r: { user_id: string; email: string | null }) => ({
      user_id: r.user_id,
      email: r.email ?? "",
      display_name: formatUserDisplayName(r.email ?? null),
    }))

    return NextResponse.json({ users })
  } catch (error: unknown) {
    console.error("Error in users search:", error)
    const msg = (error as { message?: string })?.message || "Failed to search users"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
