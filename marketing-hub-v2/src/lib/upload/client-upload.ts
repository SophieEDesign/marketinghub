/**
 * Upload a file without sending bytes through Next.js Route Handlers
 * (those hit a ~1MB body limit and return 413).
 *
 * Flow: ask the API for a signed Supabase URL → PUT the file directly.
 */

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export type UploadedAsset = {
  url: string;
  name: string;
  storage: "supabase";
};

async function readErrorMessage(res: Response, fallback: string) {
  const text = await res.text();
  try {
    const json = JSON.parse(text) as { error?: string };
    if (json.error) return json.error;
  } catch {
    // ignore
  }
  if (/request entity too large/i.test(text) || res.status === 413) {
    return `File too large for upload (max ${Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))}MB).`;
  }
  return text.trim().slice(0, 180) || fallback;
}

export async function uploadAssetDirect(file: File): Promise<UploadedAsset> {
  if (file.size <= 0) throw new Error("Empty file");
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(
      `File too large (max ${Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))}MB): ${file.name}`
    );
  }

  const intentRes = await fetch("/api/content/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: file.name,
      type: file.type || "application/octet-stream",
      size: file.size,
    }),
  });

  if (!intentRes.ok) {
    throw new Error(
      await readErrorMessage(intentRes, `Could not start upload for ${file.name}`)
    );
  }

  const intent = (await intentRes.json()) as {
    signedUrl?: string;
    publicUrl?: string;
    name?: string;
    error?: string;
  };

  if (!intent.signedUrl || !intent.publicUrl) {
    throw new Error(intent.error || `Could not start upload for ${file.name}`);
  }

  const putRes = await fetch(intent.signedUrl, {
    method: "PUT",
    headers: {
      "Content-Type": file.type || "application/octet-stream",
    },
    body: file,
  });

  if (!putRes.ok) {
    const detail = await putRes.text().catch(() => "");
    throw new Error(
      `Storage upload failed for ${file.name}${detail ? `: ${detail.slice(0, 120)}` : ""}`
    );
  }

  return {
    url: intent.publicUrl,
    name: intent.name || file.name,
    storage: "supabase",
  };
}
