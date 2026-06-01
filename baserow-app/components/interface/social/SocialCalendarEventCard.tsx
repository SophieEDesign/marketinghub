"use client"

import type { EventContentArg } from "@fullcalendar/core"
import { SocialPostPreviewCard } from "@/components/interface/social/SocialPostPreviewCard"
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
  const platforms = (props.platforms as SocialPlatform[]) ?? []
  const scheduledTime = props.scheduledTime as string | null
  const captionSnippet = (props.captionSnippet as string) || arg.event.title
  const thumbnailUrl = props.thumbnailUrl as string | null
  const normalizedStatus = (props.normalizedStatus as SocialWorkflowStatus) || "unknown"
  const statusLabel = props.statusLabel as string | null
  const postUrl = props.postUrl as string | null

  return (
    <SocialPostPreviewCard
      className="fc-social-event"
      platforms={platforms}
      scheduledTime={scheduledTime}
      postUrl={postUrl}
      thumbnailUrl={thumbnailUrl}
      captionSnippet={captionSnippet}
      normalizedStatus={normalizedStatus}
      statusLabel={statusLabel}
      showPlatformIcons={showPlatformIcons}
      showApprovalStatus={showApprovalStatus}
      variant="calendar"
    />
  )
}
