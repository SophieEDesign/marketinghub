"use client"

import {
  socialStatusDisplayLabel,
  type SocialWorkflowStatus,
} from "@/lib/marketing/social-media-calendar"
import { getMarketingStatusPillClassNames } from "@/lib/status-colors"
import { cn } from "@/lib/utils"

const STATUS_KEYWORD: Record<SocialWorkflowStatus, string> = {
  idea: "idea",
  draft: "draft",
  needs_review: "review",
  approved: "approved",
  scheduled: "scheduled",
  published: "published",
  unknown: "",
}

export function SocialStatusPill({
  normalizedStatus,
  label,
  className,
}: {
  normalizedStatus: SocialWorkflowStatus
  label?: string | null
  className?: string
}) {
  const display = label?.trim() || socialStatusDisplayLabel(normalizedStatus)
  const keyword = STATUS_KEYWORD[normalizedStatus]
  const { bg, text } = getMarketingStatusPillClassNames(keyword || display)

  return (
    <span
      className={cn(
        "inline-flex max-w-full truncate rounded-full px-1.5 py-px text-[10px] font-medium leading-tight",
        bg,
        text,
        className
      )}
    >
      {display}
    </span>
  )
}
