"use client";

import { useSettings } from "@/lib/useSettings";

const DEFAULT_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  draft: {
    bg: "bg-gray-200 dark:bg-gray-700",
    text: "text-gray-800 dark:text-gray-200",
  },
  "in-progress": {
    bg: "bg-blue-200 dark:bg-blue-800",
    text: "text-blue-800 dark:text-blue-200",
  },
  review: {
    bg: "bg-yellow-200 dark:bg-yellow-800",
    text: "text-yellow-800 dark:text-yellow-200",
  },
  approved: {
    bg: "bg-green-200 dark:bg-green-800",
    text: "text-green-800 dark:text-green-200",
  },
  published: {
    bg: "bg-purple-200 dark:bg-purple-800",
    text: "text-purple-800 dark:text-purple-200",
  },
  archived: {
    bg: "bg-gray-300 dark:bg-gray-600",
    text: "text-gray-700 dark:text-gray-300",
  },
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
  if (!rgb) return "#000000";
  
  // Calculate relative luminance
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return luminance > 0.5 ? "#000000" : "#ffffff";
}

export default function StatusChip({ value, size = "md" }: { value: string; size?: "sm" | "md" }) {
  const { settings } = useSettings();
  const status = value?.toLowerCase() || "";
  
  // Get color from settings or use default
  const statusColorHex = settings.status_colors?.[status] || settings.status_colors?.[value];
  
  const sizeClasses = size === "sm" ? "px-1 py-0.5 text-[10px]" : "px-2 py-1 text-xs";

  // If we have a custom color from settings, use it
  if (statusColorHex) {
    const textColor = getContrastColor(statusColorHex);
    return (
      <span
        className={`inline-flex items-center rounded-full font-medium ${sizeClasses}`}
        style={{
          backgroundColor: statusColorHex,
          color: textColor,
        }}
      >
        {value || "—"}
      </span>
    );
  }

  // Fallback to default colors
  const colors = DEFAULT_STATUS_COLORS[status] || {
    bg: "bg-gray-200 dark:bg-gray-700",
    text: "text-gray-800 dark:text-gray-200",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${colors.bg} ${colors.text} ${sizeClasses}`}
    >
      {value || "—"}
    </span>
  );
}

