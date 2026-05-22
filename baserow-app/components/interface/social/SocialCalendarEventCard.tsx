"use client"

import type { EventContentArg } from "@fullcalendar/core"
import { ImageIcon } from "lucide-react"
import { PlatformIconRow } from "@/components/interface/social/PlatformIcon"
import { SocialStatusPill } from "@/components/interface/social/SocialStatusPill"
import type { SocialPlatform, SocialWorkflowStatus } from "@/lib/marketing/social-media-calendar"

export function SocialCalendarEventCard({
  arg,
  showPlatformIcons = true,
  showApprovalStatus = true,
}: {
  arg: EventContentArg
  showPlatformIcons?: boolean
  showApprovalStatus?: boolean
}) {
  const props = arg.event.extendedProps ?? {}
  const accent = (props.accentColor as string) || "#7c3aed"
  const platforms = (props.platforms as SocialPlatform[]) ?? []
  const scheduledTime = props.scheduledTime as string | null
  const captionSnippet = (props.captionSnippet as string) || arg.event.title
  const thumbnailUrl = props.thumbnailUrl as string | null
  const normalizedStatus = (props.normalizedStatus as SocialWorkflowStatus) || "unknown"
  const statusLabel = props.statusLabel as string | null

  return (
    <div
      className="fc-social-event flex gap-1.5 min-w-0 w-full overflow-hidden rounded-md border border-border/20 bg-card/95 shadow-sm"
      style={{ borderLeftWidth: 3, borderLeftColor: accent }}
    >
      <div className="relative w-10 shrink-0 bg-muted/30 flex items-center justify-center min-h-[52px]">
        {thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumbnailUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <ImageIcon className="h-3.5 w-3.5 text-muted-foreground/45" aria-hidden />
        )}
      </div>
      <div className="flex flex-col gap-0.5 py-1 pr-1 min-w-0 flex-1">
        <div className="flex items-center justify-between gap-0.5">
          {showPlatformIcons ? (
            <PlatformIconRow platforms={platforms} max={3} size="sm" />
          ) : (
            <span />
          )}
          {scheduledTime ? (
            <span className="text-[9px] text-muted-foreground tabular-nums shrink-0">
              {scheduledTime}
            </span>
          ) : null}
        </div>
        <p className="text-[10px] font-medium leading-tight line-clamp-2 text-foreground">
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
