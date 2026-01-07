import type { BlockConfig } from "./types"
import { cn } from "@/lib/utils"

export type AppearanceConfig = NonNullable<BlockConfig['appearance']>

/**
 * Maps appearance config to CSS classes for container styling
 */
export function getAppearanceClasses(appearance?: AppearanceConfig): string {
  if (!appearance) return ""

  const classes: string[] = []

  // Background
  switch (appearance.background) {
    case 'subtle':
      classes.push('bg-gray-50')
      break
    case 'tinted':
      // Use accent color for tinted background
      const tintColor = getAccentColor(appearance.accent, 'bg')
      if (tintColor) classes.push(tintColor)
      break
    case 'emphasised':
      const emphColor = getAccentColor(appearance.accent, 'bg', true)
      if (emphColor) classes.push(emphColor)
      break
    case 'none':
    default:
      classes.push('bg-transparent')
  }

  // Border
  switch (appearance.border) {
    case 'outline':
      classes.push('border border-gray-200')
      break
    case 'card':
      classes.push('border border-gray-200 bg-white')
      break
    case 'none':
      // No border classes needed
      break
    default:
      // If border is undefined or not set, don't add border classes
      break
  }

  // Corner radius
  switch (appearance.radius) {
    case 'rounded':
      classes.push('rounded-lg')
      break
    case 'square':
    default:
      classes.push('rounded-none')
  }

  // Shadow
  switch (appearance.shadow) {
    case 'subtle':
      classes.push('shadow-sm')
      break
    case 'card':
      classes.push('shadow-md')
      break
    case 'none':
    default:
      classes.push('shadow-none')
  }

  // Padding is NOT applied here - it's applied to the content area in the wrapper
  // This function only returns container-level classes (background, border, shadow, etc.)
  // Note: padding can be 'compact' | 'normal' | 'spacious' (new style) or number (legacy)

  // Margin (top/bottom)
  switch (appearance.margin) {
    case 'small':
      classes.push('my-2')
      break
    case 'normal':
      classes.push('my-4')
      break
    case 'large':
      classes.push('my-8')
      break
    case 'none':
    default:
      classes.push('my-0')
  }

  return cn(classes)
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
      bg: emphasised ? 'bg-gray-100' : 'bg-gray-50',
      border: 'border-l-4 border-gray-400',
      text: 'text-gray-700',
    },
    blue: {
      bg: emphasised ? 'bg-blue-100' : 'bg-blue-50',
      border: 'border-l-4 border-blue-500',
      text: 'text-blue-700',
    },
    green: {
      bg: emphasised ? 'bg-green-100' : 'bg-green-50',
      border: 'border-l-4 border-green-500',
      text: 'text-green-700',
    },
    yellow: {
      bg: emphasised ? 'bg-yellow-100' : 'bg-yellow-50',
      border: 'border-l-4 border-yellow-500',
      text: 'text-yellow-700',
    },
    red: {
      bg: emphasised ? 'bg-red-100' : 'bg-red-50',
      border: 'border-l-4 border-red-500',
      text: 'text-red-700',
    },
    purple: {
      bg: emphasised ? 'bg-purple-100' : 'bg-purple-50',
      border: 'border-l-4 border-purple-500',
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
      return 'text-sm'
    case 'large':
      return 'text-xl'
    case 'medium':
    default:
      return 'text-base'
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
    return 'bg-gray-50 border-b border-gray-200'
  }

  const accentBg = getAccentColor(appearance.accent, 'bg')
  return cn('border-b border-gray-200', accentBg)
}

