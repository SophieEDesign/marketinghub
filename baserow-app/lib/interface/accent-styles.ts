import type { CSSProperties } from "react"
import { cn } from "@/lib/utils"

export type AccentEdgePosition = "top" | "left" | "none"

/**
 * Soft 2px accent edge via inset box-shadow (not thick border-left).
 * Sets --accent-color for CSS utilities when color is provided.
 */
export function accentEdgeProps(
  color: string | null | undefined,
  position: AccentEdgePosition = "left"
): { className: string; style?: CSSProperties } {
  if (!color || position === "none") {
    return { className: "" }
  }
  const edgeClass =
    position === "top" ? "accent-edge-top" : position === "left" ? "accent-edge-left" : ""
  return {
    className: edgeClass,
    style: { "--accent-color": color } as CSSProperties,
  }
}

/** Subtle hero tint wash from accent colour */
export function accentTintStyle(color: string | null | undefined): CSSProperties | undefined {
  if (!color) return undefined
  return {
    "--accent-color": color,
  } as CSSProperties
}

export function accentTintClassName(hasColor: boolean): string {
  return hasColor ? "accent-tint-wash" : ""
}

/** Tailwind preset accents for KPI metrics (no inline hex) */
export const METRIC_ACCENT_PRESETS = [
  "accent-preset-sky",
  "accent-preset-emerald",
  "accent-preset-amber",
  "accent-preset-violet",
] as const

export function metricAccentClass(index: number): string {
  return METRIC_ACCENT_PRESETS[index % METRIC_ACCENT_PRESETS.length] ?? METRIC_ACCENT_PRESETS[0]
}

export function cnAccent(
  color: string | null | undefined,
  position: AccentEdgePosition,
  ...rest: (string | undefined | false)[]
): string {
  const { className } = accentEdgeProps(color, position)
  return cn(className, ...rest)
}
