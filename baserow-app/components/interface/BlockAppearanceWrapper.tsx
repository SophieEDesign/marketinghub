"use client"

import type { PageBlock } from "@/lib/interface/types"
import { getAppearanceClasses, getAccentColor, getTitleSizeClass, getTitleAlignClass, getHeaderBarClasses } from "@/lib/interface/appearance-utils"
import { cn } from "@/lib/utils"

interface BlockAppearanceWrapperProps {
  block: PageBlock
  children: React.ReactNode
  className?: string
}

export default function BlockAppearanceWrapper({
  block,
  children,
  className,
}: BlockAppearanceWrapperProps) {
  const appearance = block.config?.appearance
  const containerClasses = getAppearanceClasses(appearance)
  const accentBorder = appearance?.accent && appearance.accent !== 'none' 
    ? getAccentColor(appearance.accent, 'border')
    : null

  // Get title from appearance or config
  const rawTitle = appearance?.title || block.config?.title || ""
  // Compatibility: historically text blocks used a default title of "Text Block" which
  // produces an unwanted header in view mode. Treat that specific default as "no title"
  // unless the user explicitly set an appearance title.
  const title =
    block.type === 'text' && !appearance?.title && rawTitle === 'Text Block'
      ? ''
      : rawTitle
  const showTitle = appearance?.showTitle !== false && !!title

  // Only apply appearance styling if any appearance settings exist
  // Otherwise, return children as-is for backward compatibility
  const hasAppearanceSettings = appearance && (
    appearance.background ||
    appearance.border ||
    appearance.radius ||
    appearance.shadow ||
    appearance.padding ||
    appearance.margin ||
    appearance.accent ||
    appearance.showTitle !== undefined ||
    appearance.titleSize ||
    appearance.titleAlign ||
    appearance.showDivider !== undefined
  )

  if (!hasAppearanceSettings) {
    return <>{children}</>
  }

  // Get padding class for content area
  // Handle both new style (string) and legacy (number)
  const getContentPadding = () => {
    if (!appearance?.padding) return 'p-4' // default
    if (typeof appearance.padding === 'number') {
      // Legacy: use numeric padding (convert to Tailwind class or use inline style)
      return '' // Will use inline style
    }
    // New style: string values
    return appearance.padding === 'compact' 
      ? 'p-2' 
      : appearance.padding === 'spacious' 
      ? 'p-6' 
      : 'p-4'
  }
  
  const contentPadding = getContentPadding()
  const legacyPaddingStyle = typeof appearance?.padding === 'number' 
    ? { padding: `${appearance.padding}px` } 
    : undefined

  return (
    <div className={cn(containerClasses, accentBorder, className, "w-full flex flex-col min-h-0")}>
      {/* Header with title */}
      {showTitle && (
        <>
          <div className={cn(
            "px-4 py-3 flex-shrink-0",
            getHeaderBarClasses(appearance)
          )}>
            <h3 className={cn(
              "font-semibold",
              getTitleSizeClass(appearance?.titleSize),
              getTitleAlignClass(appearance?.titleAlign),
              appearance?.accent && appearance.accent !== 'none'
                ? getAccentColor(appearance.accent, 'text')
                : 'text-gray-900'
            )}>
              {title}
            </h3>
          </div>
          {appearance?.showDivider && (
            <div className="border-b border-gray-200 flex-shrink-0" />
          )}
        </>
      )}

      {/* Block content with padding - use min-h-0 to allow flex children to shrink */}
      <div 
        className={cn("flex-1 min-h-0", contentPadding)}
        style={legacyPaddingStyle}
      >
        {children}
      </div>
    </div>
  )
}

