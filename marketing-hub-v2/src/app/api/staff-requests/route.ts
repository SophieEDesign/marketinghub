import { NextRequest } from "next/server";
import { jsonError, jsonOk, requireStaff } from "@/lib/api";
import {
  createStaffRequest,
  deleteStaffRequest,
  listStaffRequests,
  updateStaffRequest,
} from "@/lib/data/repos";

export async function GET() {
  const { error } = await requireStaff();
  if (error) return error;
  return jsonOk({ requests: await listStaffRequests() });
}

export async function POST(request: NextRequest) {
  const { error } = await requireStaff();
  if (error) return error;
  const body = await request.json();
  const action = body.action as string | undefined;

  if (action === "update") {
    const updated = await updateStaffRequest(body.id, body.patch ?? {});
    if (!updated) return jsonError("Not found", 404);
    return jsonOk({ item: updated });
  }

  if (action === "delete") {
    await deleteStaffRequest(body.id);
    return jsonOk({ ok: true });
  }

  const item = await createStaffRequest({
    kind: body.kind ?? "other",
    category: body.category ?? "",
    title: body.title ?? "Request",
    details: body.details ?? "",
    requested_by: body.requested_by ?? "Staff",
    needed_by: body.needed_by || null,
    attachment_url: body.attachment_url ?? "",
    status: body.status ?? "open",
  });
  return jsonOk({ item }, { status: 201 });
}
