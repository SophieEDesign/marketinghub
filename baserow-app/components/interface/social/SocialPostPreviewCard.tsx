"use client"

import { ImageIcon } from "lucide-react"
import { PlatformIcon, PlatformIconRow } from "@/components/interface/social/PlatformIcon"
import { SocialPostExternalLink } from "@/components/interface/social/SocialPostExternalLink"
import { SocialStatusPill } from "@/components/interface/social/SocialStatusPill"
import {
  socialStatusColors,
  type SocialPlatform,
  type SocialWorkflowStatus,
} from "@/lib/marketing/social-media-calendar"
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
  const statusColors = socialStatusColors(normalizedStatus)
  const primaryPlatform = platforms.find((p) => p !== "other") ?? platforms[0]

  return (
    <div
      className={cn(
        "flex min-w-0 w-full flex-col overflow-hidden rounded-xl border border-[#e4e7ec] bg-white shadow-[0_1px_2px_rgba(31,42,68,0.05)] transition-all duration-200",
        "hover:-translate-y-0.5 hover:shadow-[0_8px_18px_rgba(31,42,68,0.13)]",
        className
      )}
    >
      {!isFeed ? (
        <div className="flex items-center justify-between gap-2 border-b border-[#e4e7ec]/80 bg-[#f7f9fb] px-2 py-1">
          {showPlatformIcons ? (
            <PlatformIconRow platforms={platforms} max={4} size="sm" />
          ) : (
            <span className="min-w-0 flex-1" />
          )}
          <span className="flex shrink-0 items-center gap-1.5">
            <SocialPostExternalLink url={postUrl} showPlanableChip />
            {scheduledTime ? (
              <span className="text-[10px] font-medium tabular-nums text-[#9aa1ab]">
                {scheduledTime}
              </span>
            ) : null}
          </span>
        </div>
      ) : null}

      <div
        className={cn(
          "relative flex w-full items-center justify-center overflow-hidden bg-[#eef1f4]",
          isFeed ? "aspect-[16/10] min-h-[100px]" : "aspect-[16/9] min-h-[72px]"
        )}
      >
        {thumbnailUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={thumbnailUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
            {isFeed ? (
              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  background:
                    "linear-gradient(180deg, transparent 55%, rgba(15, 28, 43, 0.6))",
                }}
                aria-hidden
              />
            ) : null}
          </>
        ) : (
          <div className="flex flex-col items-center gap-1 py-3">
            <ImageIcon
              className={cn(isFeed ? "h-8 w-8" : "h-6 w-6", "text-[#c7ccd4]")}
              aria-hidden
            />
            <span className="text-[10px] font-medium text-[#9aa1ab]">No preview</span>
          </div>
        )}

        {isFeed && showPlatformIcons && primaryPlatform ? (
          <span className="absolute left-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-white shadow-[0_1px_4px_rgba(31,42,68,0.12)]">
            <PlatformIcon platform={primaryPlatform} size="sm" />
          </span>
        ) : null}

        {isFeed && showApprovalStatus ? (
          <span
            className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full ring-2 ring-white"
            style={{ backgroundColor: statusColors.dot }}
            aria-hidden
          />
        ) : null}
      </div>

      <div className={cn("flex min-w-0 flex-col gap-1.5", isFeed ? "p-2.5" : "p-2")}>
        {isFeed ? (
          <div className="flex items-center justify-between gap-2">
            {showPlatformIcons ? (
              <PlatformIconRow platforms={platforms} max={4} size="md" />
            ) : (
              <span className="min-w-0 flex-1" />
            )}
            <span className="flex shrink-0 items-center gap-1.5">
              <SocialPostExternalLink url={postUrl} showPlanableChip />
              {scheduledTime ? (
                <span className="text-[10px] font-medium tabular-nums text-[#9aa1ab]">
                  {scheduledTime}
                </span>
              ) : null}
            </span>
          </div>
        ) : null}

        <p
          className={cn(
            "font-medium leading-snug text-[#2c3340]",
            isFeed ? "line-clamp-3 text-sm" : "line-clamp-2 text-xs"
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
