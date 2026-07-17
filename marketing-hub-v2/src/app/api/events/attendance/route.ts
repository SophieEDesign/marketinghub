import { NextRequest } from "next/server";
import { jsonError, jsonOk, requireStaff } from "@/lib/api";
import {
  isEventAttendanceStatus,
  listAttendanceForEvent,
  upsertEventAttendance,
} from "@/lib/data/repos";

export async function GET(request: NextRequest) {
  const { error } = await requireStaff();
  if (error) return error;

  const eventId = request.nextUrl.searchParams.get("eventId")?.trim();
  if (!eventId) return jsonError("eventId is required");

  const attendance = await listAttendanceForEvent(eventId);
  return jsonOk({ attendance });
}

export async function POST(request: NextRequest) {
  const { user, error } = await requireStaff();
  if (error || !user) return error;

  const body = await request.json();
  const eventId = String(body.eventId ?? body.event_id ?? "").trim();
  const status = body.status ?? body.attendance_status;

  if (!eventId) return jsonError("eventId is required");
  if (!isEventAttendanceStatus(status)) {
    return jsonError(
      "status must be attending, maybe, not_attending, or interested"
    );
  }

  const row = await upsertEventAttendance({
    event_id: eventId,
    user_id: user.id,
    user_name: user.full_name || user.email || "Staff",
    attendance_status: status,
  });

  const attendance = await listAttendanceForEvent(eventId);
  return jsonOk({ attendance, mine: row });
}
