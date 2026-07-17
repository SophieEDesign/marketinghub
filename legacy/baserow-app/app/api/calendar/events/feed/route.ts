import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getUserRole } from "@/lib/roles"
import { buildCalendarIcs } from "@/lib/marketing/event-calendar-ics"
import { loadEventCalendarItemsServer } from "@/lib/marketing/event-calendar-server"
import type { BlockConfig } from "@/lib/interface/types"

/**
 * GET /api/calendar/events/feed
 * Subscribe-friendly ICS feed for event calendar (authenticated).
 *
 * Query: tableId (required), scope=all|attending, external=0|1
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const tableId = searchParams.get("tableId")
    if (!tableId) {
      return NextResponse.json({ error: "tableId is required" }, { status: 400 })
    }

    const scope = searchParams.get("scope") === "attending" ? "attending" : "all"
    const externalMode = searchParams.get("external") === "1"
    const role = await getUserRole()
    const isAdminView = role === "admin" && !externalMode

    const config = {
      table_id: tableId,
      event_calendar_external_mode: externalMode,
    } as BlockConfig

    const items = await loadEventCalendarItemsServer({
      supabase,
      config,
      currentUserId: user.id,
      externalMode,
      isAdminView,
      scope,
    })

    const ics = buildCalendarIcs(items)
    return new NextResponse(ics, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'attachment; filename="events.ics"',
        "Cache-Control": "private, max-age=300",
      },
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to generate feed" },
      { status: 500 }
    )
  }
}
