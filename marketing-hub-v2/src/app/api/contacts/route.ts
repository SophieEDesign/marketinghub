import { NextRequest } from "next/server";
import { jsonError, jsonOk, requireAdmin, requireStaff } from "@/lib/api";
import {
  createContact,
  deleteContact,
  listContacts,
  updateContact,
} from "@/lib/data/repos";

export async function GET() {
  const { error } = await requireStaff();
  if (error) return error;
  return jsonOk({ contacts: await listContacts() });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const action = body.action as string | undefined;

  // Delete is admin-only; create/update allowed for members (staff) and admins.
  if (action === "delete") {
    const { error } = await requireAdmin();
    if (error) return error;
    await deleteContact(body.id);
    return jsonOk({ ok: true });
  }

  const { error } = await requireStaff();
  if (error) return error;

  if (action === "update") {
    const updated = await updateContact(body.id, body.patch ?? {});
    if (!updated) return jsonError("Not found", 404);
    return jsonOk({ item: updated });
  }

  const tags = Array.isArray(body.tags)
    ? body.tags
    : String(body.tags ?? "")
        .split(",")
        .map((t: string) => t.trim())
        .filter(Boolean);

  const item = await createContact({
    name: body.name ?? "Contact",
    organisation: body.organisation ?? "",
    role: body.role ?? "",
    email: body.email ?? "",
    phone: body.phone ?? "",
    tags,
    notes: body.notes ?? "",
    user_id: body.user_id ?? null,
  });
  return jsonOk({ item }, { status: 201 });
}
