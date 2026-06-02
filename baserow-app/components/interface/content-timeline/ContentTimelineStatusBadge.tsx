"use client"

import { getStatusLabel, type ContentTimelineStatus } from "@/lib/marketing/content-timeline"
import { ChoicePill } from "@/components/fields/ChoicePill"

export function ContentTimelineStatusBadge({
  status,
  className,
}: {
  status: ContentTimelineStatus
  className?: string
}) {
  return (
    <ChoicePill
      label={getStatusLabel(status)}
      fieldType="single_select"
      className={className}
      truncate
    />
  )
}
