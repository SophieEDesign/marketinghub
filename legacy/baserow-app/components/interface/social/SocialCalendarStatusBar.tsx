"use client"

import { AlertCircle, ImageOff } from "lucide-react"
import {
  socialStatusColors,
  type SocialStatusSummary,
  type SocialWorkflowStatus,
} from "@/lib/marketing/social-media-calendar"
import { cn } from "@/lib/utils"

function StatChip({
  label,
  count,
  status,
  icon,
}: {
  label: string
  count: number
  status?: SocialWorkflowStatus
  icon?: React.ReactNode
}) {
  if (count === 0) return null

  const colors = status ? socialStatusColors(status) : null

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border border-[#e4e7ec] bg-white px-2.5 py-1.5 text-xs shadow-[0_1px_2px_rgba(31,42,68,0.04)]"
      )}
    >
      {icon ??
        (colors ? (
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: colors.dot }}
            aria-hidden
          />
        ) : null)}
      <span className="tabular-nums font-semibold text-[#2c3340]">{count}</span>
      <span className="text-[#6b7280]">{label}</span>
    </span>
  )
}

export function SocialCalendarStatusBar({ summary }: { summary: SocialStatusSummary }) {
  const hasAny =
    summary.scheduled > 0 ||
    summary.needsReview > 0 ||
    summary.drafts > 0 ||
    summary.approved > 0 ||
    summary.overdue > 0 ||
    summary.missingMedia > 0

  if (!hasAny) return null

  return (
    <div
      className="flex flex-wrap items-center gap-2 border-t border-[#e4e7ec]/80 px-1 py-2.5"
      role="status"
      aria-label="Calendar summary"
    >
      <StatChip label="Scheduled" count={summary.scheduled} status="scheduled" />
      <StatChip label="Needs review" count={summary.needsReview} status="needs_review" />
      <StatChip label="Approved" count={summary.approved} status="approved" />
      <StatChip label="Drafts" count={summary.drafts} status="draft" />
      {summary.overdue > 0 ? (
        <StatChip
          label="Overdue"
          count={summary.overdue}
          icon={<AlertCircle className="h-3.5 w-3.5 shrink-0 text-[#c0292f]" aria-hidden />}
        />
      ) : null}
      {summary.missingMedia > 0 ? (
        <StatChip
          label="Missing media"
          count={summary.missingMedia}
          icon={<ImageOff className="h-3.5 w-3.5 shrink-0 text-[#9aa1ab]" aria-hidden />}
        />
      ) : null}
    </div>
  )
}
