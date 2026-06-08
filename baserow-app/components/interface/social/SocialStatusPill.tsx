"use client"

import {
  socialStatusDisplayLabel,
  type SocialWorkflowStatus,
} from "@/lib/marketing/social-media-calendar"
import { ChoicePill } from "@/components/fields/ChoicePill"

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

  return (
    <ChoicePill
      label={display}
      fieldType="single_select"
      truncate
      density="compact"
      className={className}
    />
  )
}
