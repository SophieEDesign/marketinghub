import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/api";
import { listEvents } from "@/lib/data/repos";
import { buildCalendarIcs } from "@/lib/events/event-ics";

/**
 * GET /api/events/feed
 * Subscribe-friendly ICS feed for the Events calendar (staff session).
 */
export async function GET() {
  const { error } = await requireStaff();
  if (error) return error;

  try {
    const events = await listEvents();
    const ics = buildCalendarIcs(events);
    return new NextResponse(ics, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'attachment; filename="marketing-events.ics"',
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to generate feed" },
      { status: 500 }
    );
  }
}
