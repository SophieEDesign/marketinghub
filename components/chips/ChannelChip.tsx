"use client";

import { useSettings } from "@/lib/useSettings";

const DEFAULT_CHANNEL_COLORS: Record<string, string> = {
  linkedin: "#0077b5",
  facebook: "#1877f2",
  instagram: "#e4405f",
  x: "#000000",
  twitter: "#000000",
  website: "#06b6d4",
  blog: "#8b5cf6",
  email: "#f97316",
  youtube: "#ff0000",
  tiktok: "#000000",
  pr: "#10b981",
  internal: "#b45309",
};

function hexToRgb(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

function getContrastColor(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return "#ffffff";
  
  // Calculate relative luminance
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return luminance > 0.5 ? "#000000" : "#ffffff";
}

export default function ChannelChip({ label, size = "md" }: { label: string; size?: "sm" | "md" }) {
  const { settings } = useSettings();
  const channel = label?.toLowerCase() || "";
  
  // Get color from settings or use default
  const channelColorHex = settings.channel_colors?.[channel] || DEFAULT_CHANNEL_COLORS[channel] || "#888888";

  const sizeClasses = size === "sm" ? "px-1 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs";
  const textColor = getContrastColor(channelColorHex);

  return (
    <span
      className={`inline-flex items-center rounded font-medium ${sizeClasses}`}
      style={{
        backgroundColor: channelColorHex,
        color: textColor,
      }}
    >
      {label || "—"}
    </span>
  );
}

