"use client"

import type { PageBlock } from "@/lib/interface/types"
import { SocialMediaCalendarFromConfig } from "@/components/interface/SocialMediaCalendarCore"
import { cn } from "@/lib/utils"

interface SocialMediaCalendarBlockProps {
  block: PageBlock
  isEditing?: boolean
  interfaceMode?: "view" | "edit"
  pageEditable?: boolean
  isFullPage?: boolean
  pageId?: string | null
}

/**
 * Interface Builder block for the Social Media Calendar.
 * Full-page layout uses config.is_full_page on a single block page.
 */
export default function SocialMediaCalendarBlock({
  block,
  isEditing = false,
  interfaceMode = "view",
  pageEditable,
  isFullPage = false,
  pageId = null,
}: SocialMediaCalendarBlockProps) {
  const canEdit = pageEditable !== false
  const embeddedInBlock = !isFullPage

  return (
    <div
      className={cn(
        "flex h-full min-h-0 min-w-0 w-full flex-col overflow-hidden",
        isFullPage
          ? "rounded-none border-0 shadow-none"
          : "rounded-2xl border border-border/40 bg-background"
      )}
      data-block-type="social_media_calendar"
      data-block-selectable
    >
      <SocialMediaCalendarFromConfig
        config={block.config}
        canEdit={canEdit}
        isEditing={isEditing}
        interfaceMode={interfaceMode}
        embeddedInBlock={embeddedInBlock}
        className="flex-1 min-h-0 p-3 md:p-4"
        pageId={pageId}
      />
    </div>
  )
}
