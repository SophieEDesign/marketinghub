import { NextRequest } from "next/server";
import { jsonError, jsonOk, requireStaff } from "@/lib/api";
import {
  createSponsorship,
  deleteSponsorship,
  getSponsorship,
  listSponsorships,
  updateSponsorship,
} from "@/lib/data/repos";
import {
  canManagePartnerRecord,
  isPartnersAdmin,
} from "@/lib/partners/access";
import type { Sponsorship } from "@/lib/types";

function partnerKindOf(kind: unknown): "membership" | "sponsorship" {
  return kind === "membership" ? "membership" : "sponsorship";
}

/** Value / fee is internal (admin) only — redact for members. */
function redactPartnerValue(item: Sponsorship): Sponsorship {
  return { ...item, value: "" };
}

export async function GET() {
  const { user, error } = await requireStaff();
  if (error) return error;
  const sponsorships = await listSponsorships();
  if (!isPartnersAdmin(user)) {
    return jsonOk({
      sponsorships: sponsorships.map(redactPartnerValue),
    });
  }
  return jsonOk({ sponsorships });
}

export async function POST(request: NextRequest) {
  const { user, error } = await requireStaff();
  if (error) return error;
  const body = await request.json();
  const action = body.action as string | undefined;
  const admin = isPartnersAdmin(user);

  if (action === "update") {
    const existing = await getSponsorship(body.id);
    if (!existing) return jsonError("Not found", 404);
    if (!canManagePartnerRecord(existing, user)) {
      return jsonError(
        existing.kind === "membership"
          ? "You can only edit memberships you added"
          : "Only admins can edit sponsorships",
        403
      );
    }
    const patch = { ...(body.patch ?? {}) } as Record<string, unknown>;
    // Members cannot convert a membership into a sponsorship.
    if (!admin && patch.kind !== undefined && patch.kind !== "membership") {
      return jsonError("Members can only manage memberships", 403);
    }
    // Never allow clients to reassign ownership.
    delete patch.created_by_user_id;
    delete patch.created_by;
    if (!admin) {
      patch.kind = "membership";
      // Preserve existing fee/value — members cannot read or change it.
      delete patch.value;
    }
    const updated = await updateSponsorship(body.id, patch);
    if (!updated) return jsonError("Not found", 404);
    return jsonOk({
      item: admin ? updated : redactPartnerValue(updated),
    });
  }

  if (action === "delete") {
    const existing = await getSponsorship(body.id);
    if (!existing) return jsonError("Not found", 404);
    if (!canManagePartnerRecord(existing, user)) {
      return jsonError(
        existing.kind === "membership"
          ? "You can only delete memberships you added"
          : "Only admins can delete sponsorships",
        403
      );
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
    value: admin ? (body.value ?? "") : "",
    status: body.status ?? "prospect",
    deliverables: body.deliverables ?? "",
    owner: body.owner ?? "",
    onedrive_url: body.onedrive_url ?? "",
    notes: body.notes ?? "",
    created_by: user.full_name || user.email || "Staff",
    created_by_user_id: user.id,
  });
  return jsonOk(
    { item: admin ? item : redactPartnerValue(item) },
    { status: 201 }
  );
}
