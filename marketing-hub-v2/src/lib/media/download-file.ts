/** Trigger a real file download (not just open in a new tab). */
export async function downloadMediaFile(
  url: string,
  filename: string,
  options?: { shareToken?: string }
): Promise<void> {
  const source = url.trim();
  if (!source) throw new Error("No file URL");

  const safeName =
    (filename || "download").replace(/[\\/:*?"<>|]+/g, "_").trim() ||
    "download";

  const params = new URLSearchParams({
    url: source,
    filename: safeName,
  });
  if (options?.shareToken) {
    params.set("token", options.shareToken);
  }

  const res = await fetch(`/api/media/download?${params.toString()}`);
  if (!res.ok) {
    const json = (await res.json().catch(() => null)) as
      | { error?: string }
      | null;
    throw new Error(json?.error || "Download failed");
  }

  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = safeName;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
