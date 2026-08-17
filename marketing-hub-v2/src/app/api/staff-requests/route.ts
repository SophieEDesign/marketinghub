import { NextRequest } from "next/server";
import { jsonError, jsonOk, requireStaff } from "@/lib/api";
import {
  createStaffRequest,
  deleteStaffRequest,
  getStaffRequest,
  listStaffRequests,
  updateStaffRequest,
} from "@/lib/data/repos";
import {
  notifyMarketingAlert,
  staffRequestAlertKind,
} from "@/lib/email/send-marketing-alert";

export async function GET() {
  const { error } = await requireStaff();
  if (error) return error;
  return jsonOk({ requests: await listStaffRequests() });
}

export async function POST(request: NextRequest) {
  const { error, user } = await requireStaff();
  if (error) return error;
  const body = await request.json();
  const action = body.action as string | undefined;

  if (action === "update") {
    const updated = await updateStaffRequest(body.id, body.patch ?? {});
    if (!updated) return jsonError("Not found", 404);
    return jsonOk({ item: updated });
  }

  if (action === "delete") {
    const existing = await getStaffRequest(body.id);
    if (!existing) return jsonError("Not found", 404);
    const isAdmin = user.role === "admin";
    const isOwner = existing.requested_by === user.full_name;
    if (!isAdmin && !isOwner) {
      return jsonError("You can only delete requests you have sent", 403);
    }
    await deleteStaffRequest(body.id);
    return jsonOk({ ok: true });
  }

  const kind = body.kind ?? "other";
  const item = await createStaffRequest({
    kind,
    category: body.category ?? "",
    title: body.title ?? "Request",
    details: body.details ?? "",
    requested_by: body.requested_by ?? "Staff",
    needed_by: body.needed_by || null,
    attachment_url: body.attachment_url ?? "",
    status: body.status ?? "open",
  });
  notifyMarketingAlert({ kind: staffRequestAlertKind(kind) });
  return jsonOk({ item }, { status: 201 });
}
