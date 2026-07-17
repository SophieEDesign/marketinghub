import { NextRequest } from "next/server";
import { jsonError, jsonOk, requireStaff } from "@/lib/api";
import {
  createSponsorship,
  deleteSponsorship,
  getSponsorship,
  listSponsorships,
  updateSponsorship,
} from "@/lib/data/repos";

function isAdminUser(role: string) {
  return role === "admin";
}

function partnerKindOf(kind: unknown): "membership" | "sponsorship" {
  return kind === "membership" ? "membership" : "sponsorship";
}

export async function GET() {
  const { error } = await requireStaff();
  if (error) return error;
  return jsonOk({ sponsorships: await listSponsorships() });
}

export async function POST(request: NextRequest) {
  const { user, error } = await requireStaff();
  if (error) return error;
  const body = await request.json();
  const action = body.action as string | undefined;
  const admin = isAdminUser(user.role);

  if (action === "update") {
    const existing = await getSponsorship(body.id);
    if (!existing) return jsonError("Not found", 404);
    const existingKind = partnerKindOf(existing.kind);
    if (!admin && existingKind !== "membership") {
      return jsonError("Only admins can edit sponsorships", 403);
    }
    const patch = { ...(body.patch ?? {}) } as Record<string, unknown>;
    // Members cannot convert a membership into a sponsorship.
    if (!admin && patch.kind !== undefined && patch.kind !== "membership") {
      return jsonError("Members can only manage memberships", 403);
    }
    if (!admin) patch.kind = "membership";
    const updated = await updateSponsorship(body.id, patch);
    if (!updated) return jsonError("Not found", 404);
    return jsonOk({ item: updated });
  }

  if (action === "delete") {
    const existing = await getSponsorship(body.id);
    if (!existing) return jsonError("Not found", 404);
    if (!admin && partnerKindOf(existing.kind) !== "membership") {
      return jsonError("Only admins can delete sponsorships", 403);
    }
    await deleteSponsorship(body.id);
    return jsonOk({ ok: true });
  }

  const kind = partnerKindOf(body.kind);
  if (!admin && kind !== "membership") {
    return jsonError("Members can add memberships only", 403);
  }

  const item = await createSponsorship({
    kind,
    partner: body.partner ?? (kind === "membership" ? "Organisation" : "Partner"),
    package_name: body.package_name ?? "",
    starts_at: body.starts_at ?? null,
    ends_at: body.ends_at ?? null,
    value: body.value ?? "",
    status: body.status ?? "prospect",
    deliverables: body.deliverables ?? "",
    owner: body.owner ?? "",
    onedrive_url: body.onedrive_url ?? "",
    notes: body.notes ?? "",
  });
  return jsonOk({ item }, { status: 201 });
}
