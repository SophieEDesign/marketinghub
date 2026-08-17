import { NextRequest } from "next/server";
import { jsonError, jsonOk, requireAdmin } from "@/lib/api";
import {
  createPlatformCredential,
  deletePlatformCredential,
  listPlatformCredentials,
  updatePlatformCredential,
} from "@/lib/data/repos";
import type { PlatformCredential } from "@/lib/types";

function patchFromBody(
  patch: Record<string, unknown>
): Partial<PlatformCredential> {
  const out: Partial<PlatformCredential> = {};
  if (patch.platform !== undefined) {
    out.platform = String(patch.platform).trim() || "Other";
  }
  if (patch.url !== undefined) out.url = String(patch.url).trim();
  if (patch.username !== undefined) {
    out.username = String(patch.username).trim();
  }
  if (patch.password !== undefined) out.password = String(patch.password);
  if (patch.notes !== undefined) out.notes = String(patch.notes);
  return out;
}

function bodyToInput(body: Record<string, unknown>) {
  return {
    platform: String(body.platform ?? "").trim() || "Other",
    url: String(body.url ?? "").trim(),
    username: String(body.username ?? "").trim(),
    password: String(body.password ?? ""),
    notes: String(body.notes ?? ""),
  } satisfies Omit<PlatformCredential, "id" | "created_at" | "updated_at">;
}

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;
  return jsonOk({ logins: await listPlatformCredentials() });
}

export async function POST(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;
  const body = (await request.json()) as Record<string, unknown>;
  const action = body.action as string | undefined;

  if (action === "update") {
    const patch = body.patch as Record<string, unknown> | undefined;
    if (!patch) return jsonError("Missing patch", 400);
    const updated = await updatePlatformCredential(
      String(body.id),
      patchFromBody(patch)
    );
    if (!updated) return jsonError("Not found", 404);
    return jsonOk({ item: updated });
  }

  if (action === "delete") {
    await deletePlatformCredential(String(body.id));
    return jsonOk({ ok: true });
  }

  const item = await createPlatformCredential(bodyToInput(body));
  return jsonOk({ item }, { status: 201 });
}
