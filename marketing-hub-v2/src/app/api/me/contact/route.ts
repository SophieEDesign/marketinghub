import { NextRequest } from "next/server";
import { jsonError, jsonOk, requireStaff } from "@/lib/api";
import {
  createContact,
  getContactByEmail,
  getContactByUserId,
  linkUserToContact,
  updateContact,
} from "@/lib/data/repos";

/** Member (and admin) access to their own linked contact only. */
export async function GET() {
  const { user, error } = await requireStaff();
  if (error) return error;

  let contact = await getContactByUserId(user.id);
  if (!contact && user.email) {
    const byEmail = await getContactByEmail(user.email);
    if (byEmail && !byEmail.user_id) {
      contact = (await linkUserToContact(user.id, byEmail.id)) ?? byEmail;
    }
  }

  return jsonOk({ contact });
}

export async function POST(request: NextRequest) {
  const { user, error } = await requireStaff();
  if (error) return error;

  const body = await request.json();
  const action = body.action as string | undefined;

  let contact = await getContactByUserId(user.id);
  if (!contact && user.email) {
    const byEmail = await getContactByEmail(user.email);
    if (byEmail && !byEmail.user_id) {
      contact = (await linkUserToContact(user.id, byEmail.id)) ?? byEmail;
    }
  }

  if (action === "create" || (!contact && action !== "update")) {
    if (contact) {
      return jsonError("You already have a linked contact", 400);
    }
    const tags = Array.isArray(body.tags)
      ? body.tags
      : String(body.tags ?? "")
          .split(",")
          .map((t: string) => t.trim())
          .filter(Boolean);
    const item = await createContact({
      name: String(body.name ?? user.full_name ?? "Contact").trim() || "Contact",
      organisation: body.organisation ?? "",
      role: body.role ?? "",
      email: body.email ?? user.email ?? "",
      phone: body.phone ?? "",
      tags,
      notes: body.notes ?? "",
      user_id: user.id,
    });
    return jsonOk({ contact: item }, { status: 201 });
  }

  if (!contact) {
    return jsonError("No linked contact. Ask an admin to link your account.", 404);
  }

  const tags =
    body.tags === undefined
      ? undefined
      : Array.isArray(body.tags)
        ? body.tags
        : String(body.tags ?? "")
            .split(",")
            .map((t: string) => t.trim())
            .filter(Boolean);

  const patch: Record<string, unknown> = {};
  if (body.name !== undefined) patch.name = String(body.name).trim() || contact.name;
  if (body.organisation !== undefined) patch.organisation = body.organisation;
  if (body.role !== undefined) patch.role = body.role;
  if (body.email !== undefined) patch.email = body.email;
  if (body.phone !== undefined) patch.phone = body.phone;
  if (tags !== undefined) patch.tags = tags;
  if (body.notes !== undefined) patch.notes = body.notes;

  const updated = await updateContact(contact.id, patch);
  if (!updated) return jsonError("Not found", 404);
  return jsonOk({ contact: updated });
}
