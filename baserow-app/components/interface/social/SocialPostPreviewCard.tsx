"use client"

import { ImageIcon } from "lucide-react"
import { PlatformIconRow } from "@/components/interface/social/PlatformIcon"
import { SocialPostExternalLink } from "@/components/interface/social/SocialPostExternalLink"
import { SocialStatusPill } from "@/components/interface/social/SocialStatusPill"
import type { SocialPlatform, SocialWorkflowStatus } from "@/lib/marketing/social-media-calendar"
import { cn } from "@/lib/utils"

export function SocialPostPreviewCard({
  platforms,
  scheduledTime,
  postUrl,
  thumbnailUrl,
  captionSnippet,
  normalizedStatus,
  statusLabel,
  showPlatformIcons = true,
  showApprovalStatus = true,
  variant = "calendar",
  className,
}: {
  platforms: SocialPlatform[]
  scheduledTime?: string | null
  postUrl?: string | null
  thumbnailUrl?: string | null
  captionSnippet: string
  normalizedStatus: SocialWorkflowStatus
  statusLabel?: string | null
  showPlatformIcons?: boolean
  showApprovalStatus?: boolean
  variant?: "calendar" | "feed"
  className?: string
}) {
  const isFeed = variant === "feed"

  return (
    <div
      className={cn(
        "flex min-w-0 w-full flex-col overflow-hidden rounded-xl border border-border/50 bg-card shadow-sm",
        className
      )}
    >
      <div
        className={cn(
          "flex items-center justify-between gap-2 border-b border-border/30 bg-muted/20",
          isFeed ? "px-2.5 py-1.5" : "px-2 py-1"
        )}
      >
        {showPlatformIcons ? (
          <PlatformIconRow platforms={platforms} max={4} size={isFeed ? "md" : "sm"} />
        ) : (
          <span className="min-w-0 flex-1" />
        )}
        <span className="flex items-center gap-1.5 shrink-0">
          <SocialPostExternalLink url={postUrl} showPlanableChip />
          {scheduledTime ? (
            <span className="text-[10px] font-medium text-muted-foreground tabular-nums">
              {scheduledTime}
            </span>
          ) : null}
        </span>
      </div>

      <div
        className={cn(
          "relative w-full bg-muted/30 flex items-center justify-center overflow-hidden",
          isFeed ? "aspect-[16/10] min-h-[100px]" : "aspect-[16/9] min-h-[72px]"
        )}
      >
        {thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbnailUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="flex flex-col items-center gap-1 py-3 text-muted-foreground/55">
            <ImageIcon className={cn(isFeed ? "h-8 w-8" : "h-6 w-6")} aria-hidden />
            <span className="text-[10px] font-medium">No preview</span>
          </div>
        )}
      </div>

      <div className={cn("flex flex-col gap-1.5 min-w-0", isFeed ? "p-2.5" : "p-2")}>
        <p
          className={cn(
            "font-medium leading-snug text-foreground",
            isFeed ? "text-sm line-clamp-3" : "text-xs line-clamp-2"
          )}
        >
          {captionSnippet}
        </p>
        {showApprovalStatus ? (
          <SocialStatusPill
            normalizedStatus={normalizedStatus}
            label={statusLabel}
            className="self-start"
          />
        ) : null}
      </div>
    </div>
  )
}
