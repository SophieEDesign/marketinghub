"use client"

import { ImageIcon } from "lucide-react"
import AccentCard from "@/components/interface/primitives/AccentCard"
import { PlatformIconRow } from "@/components/interface/social/PlatformIcon"
import { SocialStatusPill } from "@/components/interface/social/SocialStatusPill"
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
    <AccentCard
      accentColor={item.accentColor}
      accentPosition="left"
      interactive={!!onClick}
      selected={selected}
      onClick={onClick}
      className={cn("overflow-hidden p-0", onClick && "cursor-pointer")}
    >
      <div className={cn("flex gap-0 min-w-0", compact ? "flex-row" : "flex-col sm:flex-row")}>
        <div
          className={cn(
            "relative shrink-0 bg-muted/40 flex items-center justify-center overflow-hidden",
            compact ? "w-14 h-14" : "w-full sm:w-28 h-24 sm:min-h-[88px]"
          )}
        >
          {item.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.thumbnailUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <ImageIcon className="h-5 w-5 text-muted-foreground/50" aria-hidden />
          )}
        </div>
        <div className={cn("flex flex-col gap-1 min-w-0 flex-1", compact ? "p-2" : "p-2.5")}>
          <div className="flex items-center justify-between gap-1">
            {showPlatformIcons ? (
              <PlatformIconRow platforms={item.platforms} size="sm" />
            ) : (
              <span />
            )}
            {item.scheduledTime ? (
              <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                {item.scheduledTime}
              </span>
            ) : null}
          </div>
          <p className="text-xs font-medium leading-snug line-clamp-2 text-foreground">
            {item.captionSnippet}
          </p>
          {showApprovalStatus ? (
            <div className="flex items-center gap-1.5 flex-wrap mt-auto">
              <SocialStatusPill
                normalizedStatus={item.normalizedStatus}
                label={item.statusLabel}
              />
              {item.missingMedia ? (
                <span className="text-[9px] text-muted-foreground">No media</span>
              ) : null}
            </div>
          ) : null}
          {!compact ? (
            <p className="text-[10px] text-muted-foreground truncate">
              {formatSocialDateTime(item)}
            </p>
          ) : null}
        </div>
      </div>
    </AccentCard>
  )
}
