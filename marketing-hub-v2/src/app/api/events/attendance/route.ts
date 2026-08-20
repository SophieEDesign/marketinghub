import { NextRequest } from "next/server";
import { jsonError, jsonOk, requireStaff } from "@/lib/api";
import {
  deleteEventAttendance,
  getContact,
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
  const action = body.action === "remove" ? "remove" : "upsert";
  const contactId = String(body.contactId ?? body.contact_id ?? "").trim();
  const requestedUserId = String(body.userId ?? body.user_id ?? "").trim();
  const requestedUserName = String(
    body.userName ?? body.user_name ?? ""
  ).trim();

  if (!eventId) return jsonError("eventId is required");

  if (action === "remove") {
    const targetId = requestedUserId || user.id;
    await deleteEventAttendance(eventId, targetId);
    const attendance = await listAttendanceForEvent(eventId);
    return jsonOk({ attendance });
  }

  const status = body.status ?? body.attendance_status;
  if (!isEventAttendanceStatus(status)) {
    return jsonError(
      "status must be attending, maybe, not_attending, or interested"
    );
  }

  let userId = user.id;
  let userName = user.full_name || user.email || "Staff";

  if (contactId) {
    const contact = await getContact(contactId);
    if (!contact) return jsonError("Contact not found", 404);
    userId = (contact.user_id ?? "").trim() || `contact:${contact.id}`;
    userName = contact.name.trim() || "Contact";
  } else if (requestedUserId && requestedUserId !== user.id) {
    userId = requestedUserId;
    userName = requestedUserName || "Staff";
  }

  const row = await upsertEventAttendance({
    event_id: eventId,
    user_id: userId,
    user_name: userName,
    attendance_status: status,
  });

  const attendance = await listAttendanceForEvent(eventId);
  return jsonOk({ attendance, mine: row });
}
