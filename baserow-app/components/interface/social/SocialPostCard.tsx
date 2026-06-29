"use client"

import { SocialPostPreviewCard } from "@/components/interface/social/SocialPostPreviewCard"
import {
  formatSocialDateTime,
  type SocialCalendarItem,
} from "@/lib/marketing/social-media-calendar"
import { cn } from "@/lib/utils"

export function SocialPostCard({
  item,
  selected,
  onClick,
  compact = false,
  showPlatformIcons = true,
  showApprovalStatus = true,
}: {
  item: SocialCalendarItem
  selected?: boolean
  onClick?: () => void
  compact?: boolean
  showPlatformIcons?: boolean
  showApprovalStatus?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "w-full min-w-0 rounded-xl text-left transition-shadow",
        onClick &&
          "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#005b8f]/40",
        selected && "rounded-xl ring-2 ring-[#005b8f]/35",
        !onClick && "cursor-default"
      )}
    >
      <SocialPostPreviewCard
        platforms={item.platforms}
        scheduledTime={item.scheduledTime}
        postUrl={item.postUrl}
        thumbnailUrl={item.thumbnailUrl}
        captionSnippet={item.captionSnippet}
        normalizedStatus={item.normalizedStatus}
        statusLabel={item.statusLabel}
        showPlatformIcons={showPlatformIcons}
        showApprovalStatus={showApprovalStatus}
        variant={compact ? "calendar" : "feed"}
      />
      {!compact ? (
        <p className="mt-1 px-0.5 text-[10px] text-muted-foreground truncate">
          {formatSocialDateTime(item)}
        </p>
      ) : null}
      {item.missingMedia && showApprovalStatus ? (
        <p className="mt-0.5 text-[9px] text-muted-foreground px-0.5">No media attached</p>
      ) : null}
    </button>
  )
}
