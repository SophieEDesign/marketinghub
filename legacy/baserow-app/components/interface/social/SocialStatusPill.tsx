"use client"

import {
  socialStatusColors,
  socialStatusDisplayLabel,
  type SocialWorkflowStatus,
} from "@/lib/marketing/social-media-calendar"
import { cn } from "@/lib/utils"

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
  const colors = socialStatusColors(normalizedStatus)

  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium leading-none",
        className
      )}
      style={{ backgroundColor: colors.bg, color: colors.fg }}
    >
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: colors.dot }}
        aria-hidden
      />
      <span className="truncate">{display}</span>
    </span>
  )
}
