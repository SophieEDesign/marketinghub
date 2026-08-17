import { NextRequest } from "next/server";
import { jsonError, jsonOk, requireAdmin, requireStaff } from "@/lib/api";
import {
  createAdvertisement,
  deleteAdvertisement,
  listAdvertisements,
  updateAdvertisement,
} from "@/lib/data/repos";
import type { Advertisement, AdvertisementStatus } from "@/lib/types";

function parseStatus(value: unknown): AdvertisementStatus {
  const s = String(value ?? "planned");
  if (s === "active" || s === "complete" || s === "cancelled") return s;
  return "planned";
}

function patchFromBody(
  patch: Record<string, unknown>
): Partial<Advertisement> {
  const out: Partial<Advertisement> = {};
  if (patch.title !== undefined) {
    out.title = String(patch.title).trim() || "Untitled advertisement";
  }
  if (patch.publication !== undefined) {
    out.publication = String(patch.publication).trim();
  }
  if (patch.status !== undefined) out.status = parseStatus(patch.status);
  if (patch.starts_at !== undefined) {
    out.starts_at = patch.starts_at ? String(patch.starts_at) : null;
  }
  if (patch.ends_at !== undefined) {
    out.ends_at = patch.ends_at ? String(patch.ends_at) : null;
  }
  if (patch.artwork_url !== undefined) {
    out.artwork_url = String(patch.artwork_url).trim();
  }
  if (patch.agreement_url !== undefined) {
    out.agreement_url = String(patch.agreement_url).trim();
  }
  if (patch.notes !== undefined) out.notes = String(patch.notes);
  return out;
}

function bodyToInput(body: Record<string, unknown>) {
  return {
    title: String(body.title ?? "").trim() || "Untitled advertisement",
    publication: String(body.publication ?? "").trim(),
    status: parseStatus(body.status),
    starts_at: body.starts_at ? String(body.starts_at) : null,
    ends_at: body.ends_at ? String(body.ends_at) : null,
    artwork_url: String(body.artwork_url ?? "").trim(),
    agreement_url: String(body.agreement_url ?? "").trim(),
    notes: String(body.notes ?? ""),
  } satisfies Omit<Advertisement, "id" | "created_at" | "updated_at">;
}

export async function GET() {
  const { error } = await requireStaff();
  if (error) return error;
  return jsonOk({ advertisements: await listAdvertisements() });
}

export async function POST(request: NextRequest) {
  const { error } = await requireStaff();
  if (error) return error;
  const body = (await request.json()) as Record<string, unknown>;
  const action = body.action as string | undefined;

  if (action === "update") {
    const patch = body.patch as Record<string, unknown> | undefined;
    if (!patch) return jsonError("Missing patch", 400);
    const updated = await updateAdvertisement(
      String(body.id),
      patchFromBody(patch)
    );
    if (!updated) return jsonError("Not found", 404);
    return jsonOk({ item: updated });
  }

  if (action === "delete") {
    const admin = await requireAdmin();
    if (admin.error) return admin.error;
    await deleteAdvertisement(String(body.id));
    return jsonOk({ ok: true });
  }

  const item = await createAdvertisement(bodyToInput(body));
  return jsonOk({ item }, { status: 201 });
}
