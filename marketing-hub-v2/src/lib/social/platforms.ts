/** Platform badge colours / initials for social calendar cards. */

export type PlatformKey =
  | "linkedin"
  | "instagram"
  | "facebook"
  | "x"
  | "tiktok"
  | "youtube"
  | "social";

export function platformKey(raw: string): PlatformKey {
  const s = raw.toLowerCase();
  if (s.includes("linkedin") || s === "li") return "linkedin";
  if (s.includes("instagram") || s === "ig") return "instagram";
  if (s.includes("facebook") || s === "fb") return "facebook";
  if (s === "x" || s.includes("twitter") || s.includes("tweet")) return "x";
  if (s.includes("tiktok")) return "tiktok";
  if (s.includes("youtube") || s === "yt") return "youtube";
  return "social";
}

export const PLATFORM_META: Record<
  PlatformKey,
  { label: string; bg: string; fg: string; short: string }
> = {
  linkedin: { label: "LinkedIn", bg: "#0A66C2", fg: "#fff", short: "in" },
  instagram: { label: "Instagram", bg: "#E1306C", fg: "#fff", short: "IG" },
  facebook: { label: "Facebook", bg: "#1877F2", fg: "#fff", short: "f" },
  x: { label: "X", bg: "#111111", fg: "#fff", short: "𝕏" },
  tiktok: { label: "TikTok", bg: "#010101", fg: "#fff", short: "♪" },
  youtube: { label: "YouTube", bg: "#FF0000", fg: "#fff", short: "▶" },
  social: { label: "Social", bg: "#64748b", fg: "#fff", short: "S" },
};

export function isImageUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const u = url.toLowerCase();
  if (u.startsWith("data:image")) return true;
  return /\.(png|jpe?g|gif|webp|avif)(\?|$)/i.test(u) || u.includes("image");
}

/** True for Canva design / share links (not CDN image exports). */
export function isCanvaUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (!(host === "canva.com" || host.endsWith(".canva.com"))) return false;
    // Skip media CDN hosts — those are image/file assets, not editor links.
    if (host.includes("media") || host.startsWith("export.")) return false;
    return /\/design\//i.test(parsed.pathname);
  } catch {
    return /canva\.com\/design\//i.test(url);
  }
}

/** Normalize a Canva design link to the /view URL. */
export function toCanvaViewUrl(url: string): string | null {
  if (!isCanvaUrl(url)) return null;
  try {
    const u = new URL(url);
    let path = u.pathname.replace(/\/+$/, "");
    path = path.replace(/\/(edit|view|watch|present)$/i, "");
    u.pathname = `${path}/view`;
    u.search = "";
    u.hash = "";
    return u.toString();
  } catch {
    return null;
  }
}

/** Canva public/share embed URL (shows the actual design when embedding is allowed). */
export function toCanvaEmbedUrl(url: string): string | null {
  const view = toCanvaViewUrl(url);
  if (!view) return null;
  return `${view}?embed`;
}
