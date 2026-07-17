import { promises as fs } from "fs";
import path from "path";
import { NextRequest } from "next/server";
import { jsonError, jsonOk, requireStaff } from "@/lib/api";
import { hasSupabaseConfig } from "@/lib/auth/config";
import { getDataDir } from "@/lib/store/paths";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const UPLOAD_ROOT = path.join(getDataDir(), "uploads", "content");
const MAX_BYTES = 12 * 1024 * 1024; // 12MB
const ALLOWED = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "application/pdf",
  "video/mp4",
  "video/quicktime",
]);

function safeName(name: string) {
  return name
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120);
}

async function uploadToSupabase(
  bytes: Buffer,
  filename: string,
  contentType: string
): Promise<string | null> {
  if (!hasSupabaseConfig()) return null;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return null;
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceKey,
      { auth: { persistSession: false } }
    );
    const objectPath = `hub-content/${Date.now()}-${filename}`;
    const { error } = await supabase.storage
      .from("attachments")
      .upload(objectPath, bytes, { contentType, upsert: false });
    if (error) return null;
    const { data } = supabase.storage
      .from("attachments")
      .getPublicUrl(objectPath);
    return data.publicUrl || null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const { error } = await requireStaff();
  if (error) return error;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError("Expected multipart form data", 400);
  }

  const file = form.get("file");
  if (!file || typeof file === "string") {
    return jsonError("No file uploaded", 400);
  }

  const blob = file as File;
  if (blob.size <= 0) return jsonError("Empty file", 400);
  if (blob.size > MAX_BYTES) {
    return jsonError("File too large (max 12MB)", 400);
  }

  const type = blob.type || "application/octet-stream";
  if (!ALLOWED.has(type) && !/\.(png|jpe?g|gif|webp|svg|pdf|mp4|mov)$/i.test(blob.name)) {
    return jsonError("File type not allowed", 400);
  }

  const bytes = Buffer.from(await blob.arrayBuffer());
  const filename = `${Date.now()}-${safeName(blob.name || "asset")}`;

  const remoteUrl = await uploadToSupabase(bytes, filename, type);
  if (remoteUrl) {
    return jsonOk({ url: remoteUrl, name: blob.name, storage: "supabase" });
  }

  await fs.mkdir(UPLOAD_ROOT, { recursive: true });
  await fs.writeFile(path.join(UPLOAD_ROOT, filename), bytes);
  const url = `/api/uploads/content/${encodeURIComponent(filename)}`;
  return jsonOk({ url, name: blob.name, storage: "local" }, { status: 201 });
}
