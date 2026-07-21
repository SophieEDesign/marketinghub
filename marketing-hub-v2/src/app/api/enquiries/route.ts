import { NextRequest } from "next/server";
import { jsonError, jsonOk, requireStaff } from "@/lib/api";
import {
  deleteWebEnquiry,
  listWebEnquiries,
  requireWebhookSecret,
  updateWebEnquiry,
  upsertWebEnquiryFromWebhook,
} from "@/lib/data/web-enquiries";
import type { WebEnquiryStatus } from "@/lib/types";
import { hasServiceRoleKey } from "@/lib/supabase/admin";

/**
 * Staff list: GET with session.
 * Webhook ingest: POST with ?key= / X-Webhook-Secret / Bearer (no session).
 * Staff mutations: POST with session + action update|delete.
 */
export async function GET(request: NextRequest) {
  const { error } = await requireStaff();
  if (error) return error;

  if (!hasServiceRoleKey()) {
    return jsonOk({ enquiries: [], configured: false });
  }

  const includeTest =
    request.nextUrl.searchParams.get("include_test") === "1" ||
    request.nextUrl.searchParams.get("include_test") === "true";

  try {
    const enquiries = await listWebEnquiries({ includeTest });
    return jsonOk({ enquiries, configured: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to list";
    return jsonError(message, 500);
  }
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body || typeof body !== "object") {
    return jsonError("JSON body required");
  }

  const action = typeof body.action === "string" ? body.action : undefined;

  // Staff mutations (session auth)
  if (action === "update" || action === "delete") {
    const { error } = await requireStaff();
    if (error) return error;

    if (!hasServiceRoleKey()) {
      return jsonError("Enquiries storage is not configured", 503);
    }

    try {
      if (action === "delete") {
        const id = String(body.id ?? "");
        if (!id) return jsonError("id is required");
        await deleteWebEnquiry(id);
        return jsonOk({ ok: true });
      }

      const id = String(body.id ?? "");
      if (!id) return jsonError("id is required");
      const patch =
        body.patch && typeof body.patch === "object"
          ? (body.patch as { status?: WebEnquiryStatus })
          : {};
      const status = patch.status ?? (body.status as WebEnquiryStatus | undefined);
      const updated = await updateWebEnquiry(id, { status });
      if (!updated) return jsonError("Not found", 404);
      return jsonOk({ item: updated });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Update failed";
      return jsonError(message, 500);
    }
  }

  // Webhook ingest (secret auth — WordPress Quote Builder)
  if (!requireWebhookSecret(request)) {
    return jsonError("Unauthorized", 401);
  }

  if (!hasServiceRoleKey()) {
    return jsonError("Enquiries storage is not configured", 503);
  }

  try {
    const item = await upsertWebEnquiryFromWebhook(body);
    return jsonOk({
      ok: true,
      id: item.id,
      submission_id: item.submission_id,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ingest failed";
    const status = message.includes("submission_id") ? 400 : 500;
    return jsonError(message, status);
  }
}
