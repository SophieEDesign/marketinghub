import { NextRequest } from "next/server";
import { jsonError, jsonOk, requireStaff } from "@/lib/api";
import { hasSupabaseConfig } from "@/lib/auth/config";
import {
  createMediaInSupabase,
  softDeleteMediaInSupabase,
} from "@/lib/supabase/media-list";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const { user, error } = await requireStaff();
  if (error) return error;
  if (!user) return jsonError("Unauthorized", 401);

  if (!hasSupabaseConfig()) {
    return jsonError("Supabase is not configured", 503);
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const action = body.action as string | undefined;

  try {
    if (action === "delete") {
      const id = typeof body.id === "string" ? body.id : "";
      if (!id) return jsonError("id is required");
      await softDeleteMediaInSupabase(id, user.id);
      return jsonOk({ ok: true });
    }

    const name = typeof body.name === "string" ? body.name : "";
    if (!name.trim()) return jsonError("Name is required");

    const fileRaw = body.file;
    let file:
      | { url: string; name: string; type?: string; size?: number | null }
      | undefined;
    if (fileRaw && typeof fileRaw === "object") {
      const f = fileRaw as Record<string, unknown>;
      const url = typeof f.url === "string" ? f.url.trim() : "";
      if (url) {
        file = {
          url,
          name: typeof f.name === "string" ? f.name : "File",
          type: typeof f.type === "string" ? f.type : "",
          size: typeof f.size === "number" ? f.size : null,
        };
      }
    }

    const item = await createMediaInSupabase({
      name,
      public_title:
        typeof body.public_title === "string" ? body.public_title : "",
      category: typeof body.category === "string" ? body.category : "Documents",
      document_link:
        typeof body.document_link === "string" ? body.document_link : "",
      notes: typeof body.notes === "string" ? body.notes : "",
      status:
        typeof body.status === "string" ? body.status : "Internal Resource",
      file,
      actorId: user.id,
    });

    return jsonOk({ item }, { status: 201 });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Failed", 400);
  }
}
