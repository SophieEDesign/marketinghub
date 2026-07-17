import { NextRequest } from "next/server";
import { jsonError, jsonOk, requireStaff } from "@/lib/api";
import {
  createSponsorship,
  deleteSponsorship,
  listSponsorships,
  updateSponsorship,
} from "@/lib/data/repos";

export async function GET() {
  const { error } = await requireStaff();
  if (error) return error;
  return jsonOk({ sponsorships: await listSponsorships() });
}

export async function POST(request: NextRequest) {
  const { error } = await requireStaff();
  if (error) return error;
  const body = await request.json();
  const action = body.action as string | undefined;

  if (action === "update") {
    const updated = await updateSponsorship(body.id, body.patch ?? {});
    if (!updated) return jsonError("Not found", 404);
    return jsonOk({ item: updated });
  }

  if (action === "delete") {
    await deleteSponsorship(body.id);
    return jsonOk({ ok: true });
  }

  const item = await createSponsorship({
    kind: body.kind === "membership" ? "membership" : "sponsorship",
    partner: body.partner ?? "Partner",
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
