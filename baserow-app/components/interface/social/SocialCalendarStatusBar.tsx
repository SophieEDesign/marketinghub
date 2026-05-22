"use client"

import { AlertCircle, ImageOff } from "lucide-react"
import type { SocialStatusSummary } from "@/lib/marketing/social-media-calendar"
import { cn } from "@/lib/utils"

function Stat({
  label,
  count,
  dotClass,
  icon,
}: {
  label: string
  count: number
  dotClass?: string
  icon?: React.ReactNode
}) {
  if (count === 0) return null
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      {icon ?? <span className={cn("h-2 w-2 rounded-full shrink-0", dotClass)} aria-hidden />}
      <span className="tabular-nums font-medium text-foreground">{count}</span>
      <span>{label}</span>
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
      className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border/30 px-1 py-2.5"
      role="status"
      aria-label="Calendar summary"
    >
      <Stat label="Scheduled posts" count={summary.scheduled} dotClass="bg-violet-500" />
      <Stat label="Needs review" count={summary.needsReview} dotClass="bg-amber-500" />
      <Stat label="Drafts" count={summary.drafts} dotClass="bg-sky-500" />
      <Stat label="Approved" count={summary.approved} dotClass="bg-emerald-500" />
      {summary.overdue > 0 ? (
        <Stat
          label="Overdue"
          count={summary.overdue}
          icon={<AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0" aria-hidden />}
        />
      ) : null}
      {summary.missingMedia > 0 ? (
        <Stat
          label="Missing media"
          count={summary.missingMedia}
          icon={<ImageOff className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden />}
        />
      ) : null}
    </div>
  )
}
