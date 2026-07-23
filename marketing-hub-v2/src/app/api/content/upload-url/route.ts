import { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonOk, requireStaff } from "@/lib/api";
import { hasServiceRoleKey } from "@/lib/supabase/admin";
import {
  isAllowedUpload,
  MAX_UPLOAD_BYTES,
} from "@/lib/upload/allowed-types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function safeName(name: string) {
  return name
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120);
}

/**
 * Issue a short-lived Supabase signed upload URL.
 * Clients PUT the file directly to Storage — avoids Next.js ~1MB Route Handler body limit (413).
 */
export async function POST(request: NextRequest) {
  const { error } = await requireStaff();
  if (error) return error;

  if (!hasServiceRoleKey()) {
    return jsonError(
      "Direct upload requires SUPABASE_SERVICE_ROLE_KEY. Add it to .env.local.",
      503
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const parsed = z
    .object({
      name: z.string().min(1).max(200),
      type: z.string().max(120).optional(),
      size: z.number().int().nonnegative().optional(),
    })
    .safeParse(body);

  if (!parsed.success) return jsonError("Invalid upload request", 400);

  const { name, type = "application/octet-stream", size } = parsed.data;
  if (typeof size === "number" && size > MAX_UPLOAD_BYTES) {
    return jsonError(
      `File too large (max ${Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))}MB): ${name}`,
      413
    );
  }

  if (!isAllowedUpload(name, type)) {
    return jsonError("File type not allowed", 400);
  }

  try {
    const { createServiceClient } = await import("@/lib/supabase/admin");
    const supabase = createServiceClient();
    const objectPath = `hub-content/${Date.now()}-${safeName(name)}`;
    const { data, error: signError } = await supabase.storage
      .from("attachments")
      .createSignedUploadUrl(objectPath);

    if (signError || !data?.signedUrl) {
      return jsonError(
        signError?.message || "Could not create upload URL",
        500
      );
    }

    const { data: pub } = supabase.storage
      .from("attachments")
      .getPublicUrl(objectPath);

    return jsonOk({
      mode: "signed" as const,
      path: data.path || objectPath,
      token: data.token,
      signedUrl: data.signedUrl,
      publicUrl: pub.publicUrl,
      name,
    });
  } catch (e) {
    return jsonError(
      e instanceof Error ? e.message : "Could not create upload URL",
      500
    );
  }
}
