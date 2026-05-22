"use client"

import { CalendarDays, ChevronLeft, ChevronRight, GanttChart, Plus, Upload } from "lucide-react"
import type { ContentTimelineView } from "@/lib/marketing/content-timeline"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface ContentTimelineHeaderProps {
  title: string
  subtitle: string
  periodLabel: string
  view: ContentTimelineView
  showAddButton: boolean
  onViewChange: (view: ContentTimelineView) => void
  onPrevPeriod: () => void
  onNextPeriod: () => void
  onAddContent?: () => void
}

const VIEW_OPTIONS: { value: ContentTimelineView; label: string }[] = [
  { value: "month", label: "Month" },
  { value: "quarter", label: "Quarter" },
  { value: "year", label: "Year" },
]

export function ContentTimelineHeader({
  title,
  subtitle,
  periodLabel,
  view,
  showAddButton,
  onViewChange,
  onPrevPeriod,
  onNextPeriod,
  onAddContent,
}: ContentTimelineHeaderProps) {
  return (
    <div className="shrink-0 border-b border-border/40 px-3 py-3 md:px-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <GanttChart className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-foreground">{title}</h2>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          <div className="flex items-center gap-1 rounded-lg border border-border/50 bg-muted/30 px-1 py-0.5">
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={onPrevPeriod} aria-label="Previous period">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="flex items-center gap-1 px-2 text-xs font-medium text-foreground">
              <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
              {periodLabel}
            </span>
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={onNextPeriod} aria-label="Next period">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div
            className="flex rounded-lg border border-border/50 bg-muted/20 p-0.5"
            role="group"
            aria-label="Timeline period"
          >
            {VIEW_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                aria-pressed={view === opt.value}
                onClick={() => onViewChange(opt.value)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  view === opt.value
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 text-xs" disabled title="Export coming soon">
            <Upload className="h-3.5 w-3.5" />
            Export
          </Button>

          {showAddButton && (
            <Button type="button" size="sm" className="h-8 gap-1.5 text-xs" onClick={onAddContent}>
              <Plus className="h-3.5 w-3.5" />
              Add content
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
