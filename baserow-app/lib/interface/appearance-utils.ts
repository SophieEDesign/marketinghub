import type { BlockConfig } from "./types"
import { cn } from "@/lib/utils"

export type AppearanceConfig = NonNullable<BlockConfig['appearance']>

/**
 * Maps appearance config to CSS classes for container styling.
 * Container style (background, border, radius, shadow) and spacing (margin) have been
 * removed from the UI; we no longer apply them so legacy config does not drive styling.
 */
export function getAppearanceClasses(_appearance?: AppearanceConfig): string {
  return ""
}

/**
 * Gets accent color classes for header bar, left border, or highlight background
 */
export function getAccentColor(
  accent: AppearanceConfig['accent'] = 'none',
  type: 'bg' | 'border' | 'text' = 'bg',
  emphasised: boolean = false
): string | null {
  if (accent === 'none') return null

  const colorMap: Record<string, Record<string, string>> = {
    grey: {
      bg: emphasised ? 'bg-muted' : 'bg-muted/50',
      border: 'border-l-2 border-border',
      text: 'text-muted-foreground',
    },
    blue: {
      bg: emphasised ? 'bg-blue-100' : 'bg-blue-50',
      border: 'border-l-2 border-blue-400/55',
      text: 'text-blue-700',
    },
    green: {
      bg: emphasised ? 'bg-green-100' : 'bg-green-50',
      border: 'border-l-2 border-green-400/55',
      text: 'text-green-700',
    },
    yellow: {
      bg: emphasised ? 'bg-yellow-100' : 'bg-yellow-50',
      border: 'border-l-2 border-yellow-400/55',
      text: 'text-yellow-700',
    },
    red: {
      bg: emphasised ? 'bg-red-100' : 'bg-red-50',
      border: 'border-l-2 border-red-400/55',
      text: 'text-red-700',
    },
    purple: {
      bg: emphasised ? 'bg-purple-100' : 'bg-purple-50',
      border: 'border-l-2 border-purple-400/55',
      text: 'text-purple-700',
    },
  }

  return colorMap[accent]?.[type] || null
}

/**
 * Gets title size classes
 */
export function getTitleSizeClass(size: AppearanceConfig['titleSize'] = 'medium'): string {
  switch (size) {
    case 'small':
      return 'text-xs'
    case 'large':
      return 'text-base'
    case 'medium':
    default:
      return 'text-sm'
  }
}

/**
 * Gets title alignment classes
 */
export function getTitleAlignClass(align: AppearanceConfig['titleAlign'] = 'left'): string {
  switch (align) {
    case 'center':
      return 'text-center'
    case 'left':
    default:
      return 'text-left'
  }
}

/**
 * Gets header bar classes with accent color
 */
export function getHeaderBarClasses(appearance?: AppearanceConfig): string {
  if (!appearance || !appearance.accent || appearance.accent === 'none') {
    return 'bg-muted/30 border-b border-border/60'
  }

  const accentBg = getAccentColor(appearance.accent, 'bg')
  return cn('border-b border-border/60', accentBg)
}

