 "use client"
 
 import type { PageBlock } from "@/lib/interface/types"
 import { getAppearanceClasses, getAccentColor, getTitleSizeClass, getTitleAlignClass, getHeaderBarClasses } from "@/lib/interface/appearance-utils"
import { BLOCK_CONTENT_PADDING, BLOCK_HEADER_PADDING } from "@/lib/interface/spacing-tokens"
import { cn } from "@/lib/utils"
 import { getEffectiveBlockSizing } from "@/lib/interface/block-sizing"

interface BlockAppearanceWrapperProps {
  block: PageBlock
  children: React.ReactNode
  className?: string
  /** When true (full-page mode), strip all chrome: no border, radius, shadow, padding, background. Block reads as the page. */
  isFullPage?: boolean
  /** When true with isFullPage, block is a rail (fixed width); parent constrains width. */
  isRail?: boolean
}

export default function BlockAppearanceWrapper({
  block,
  children,
  className,
  isFullPage = false,
  isRail = false,
}: BlockAppearanceWrapperProps) {
  const sizing = getEffectiveBlockSizing(block)

  // Full-page: transparent dimensionless wrapper; no block chrome. Single scroll context = block internal content.
  if (isFullPage) {
    return <div className={cn("h-full w-full min-h-0 flex flex-col", className)}>{children}</div>
  }

  const appearance = block.config?.appearance
  const containerClasses = getAppearanceClasses(appearance)
  const accentBorder = appearance?.accent && appearance.accent !== 'none' 
    ? getAccentColor(appearance.accent, 'border')
    : null

  // Get title from appearance or config
  const appearanceTitle = appearance?.title || ""
  const legacyConfigTitle = block.config?.title || ""
  const rawTitle = appearanceTitle || legacyConfigTitle
  // Compatibility:
  // - Text blocks historically used a default "Text Block" title, which should not render as a header.
  // - Field blocks often store the field name in config.title (legacy / wizard behavior), but the field
  //   label should not become a block header unless the user explicitly sets a Title.
  const title = (() => {
    if (block.type === 'text' && !appearanceTitle && legacyConfigTitle === 'Text Block') {
      return ''
    }
    if (block.type === 'field' && !appearanceTitle) {
      return ''
    }
    return rawTitle
  })()
  const showTitle = appearance?.showTitle !== false && !!title

  // Only apply appearance styling if any appearance settings exist (title/header or accent).
  // Container style (background, border, radius, shadow) and spacing (padding, margin) have been removed.
  const hasAppearanceSettings = appearance && (
    appearance.accent ||
    appearance.showTitle !== undefined ||
    appearance.titleSize ||
    appearance.titleAlign ||
    appearance.showDivider !== undefined
  )

  if (!hasAppearanceSettings) {
    return <>{children}</>
  }

  return (
    <div className={cn(containerClasses, accentBorder, className, "w-full flex flex-col min-h-0")}>
      {/* Header with title */}
      {showTitle && (
        <>
          <div className={cn(
            BLOCK_HEADER_PADDING,
            "flex-shrink-0",
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

      {/* Block content with fixed padding. Field blocks: no internal flex sizing so block grows with content; no internal scroll. */}
      <div
        className={cn(
          block.type === 'field'
            ? 'overflow-visible'
            : // For content-sized blocks, avoid internal flex grow; let content drive height.
              sizing === 'content'
              ? 'overflow-hidden'
              : 'flex-1 min-h-0',
          BLOCK_CONTENT_PADDING
        )}
      >
        {children}
      </div>
    </div>
  )
}

