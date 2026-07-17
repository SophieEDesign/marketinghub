import { NextRequest } from "next/server";
import { jsonError, jsonOk, requireStaff } from "@/lib/api";
import {
  createEvent,
  deleteEvent,
  listEvents,
  updateEvent,
} from "@/lib/data/repos";

export async function GET() {
  const { error } = await requireStaff();
  if (error) return error;
  return jsonOk({ events: await listEvents() });
}

export async function POST(request: NextRequest) {
  const { user, error } = await requireStaff();
  if (error || !user) return error;
  const body = await request.json();
  const action = body.action as string | undefined;

  if (action === "update") {
    const updated = await updateEvent(body.id, body.patch ?? {});
    if (!updated) return jsonError("Event not found", 404);
    return jsonOk({ event: updated });
  }

  if (action === "delete") {
    await deleteEvent(body.id);
    return jsonOk({ ok: true });
  }

  const event = await createEvent({
    title: body.title ?? "Untitled event",
    starts_at: body.starts_at || null,
    ends_at: body.ends_at ?? null,
    location: body.location ?? "",
    event_type: body.event_type ?? "Event",
    division: body.division ?? "",
    notes: body.notes ?? "",
    link_url: body.link_url ?? "",
    created_by: user.id,
  });
  return jsonOk({ event }, { status: 201 });
}
