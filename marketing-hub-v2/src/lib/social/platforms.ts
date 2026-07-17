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
