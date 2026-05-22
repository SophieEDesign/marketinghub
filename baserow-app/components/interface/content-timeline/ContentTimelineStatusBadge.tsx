"use client"

import { getContentTimelineStatusClasses, getStatusLabel, type ContentTimelineStatus } from "@/lib/marketing/content-timeline"
import { cn } from "@/lib/utils"

export function ContentTimelineStatusBadge({
  status,
  className,
}: {
  status: ContentTimelineStatus
  className?: string
}) {
  const { bg, text } = getContentTimelineStatusClasses(status)
  return (
    <span
      className={cn(
        "inline-flex max-w-full shrink-0 truncate rounded-full px-1.5 py-px text-[10px] font-medium leading-tight",
        bg,
        text,
        className
      )}
    >
      {getStatusLabel(status)}
    </span>
  )
}
