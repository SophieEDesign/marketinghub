"use client"

import {
  CONTENT_TIMELINE_STATUSES,
  getContentTimelineStatusClasses,
} from "@/lib/marketing/content-timeline"

export function ContentTimelineStatusLegend() {
  return (
    <div className="shrink-0 border-t border-border/40 px-3 py-2">
      <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        Status legend
      </p>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {CONTENT_TIMELINE_STATUSES.map(({ value, label }) => {
          const { legend } = getContentTimelineStatusClasses(value)
          return (
            <span key={value} className="inline-flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <span className={cnDot(legend)} aria-hidden />
              {label}
            </span>
          )
        })}
      </div>
    </div>
  )
}

function cnDot(legend: string) {
  return `h-2 w-2 rounded-full ${legend}`
}
