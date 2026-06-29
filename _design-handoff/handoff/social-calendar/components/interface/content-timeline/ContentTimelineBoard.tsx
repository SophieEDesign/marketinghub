// components/interface/content-timeline/ContentTimelineBoard.tsx
"use client"

import { useMemo } from "react"
import { format, parseISO } from "date-fns"
import { CalendarDays } from "lucide-react"
import {
  CONTENT_TIMELINE_STATUSES,
  getContentTimelineStatusClasses,
  type ContentTimelineItem,
  type ContentTimelineStatus,
} from "@/lib/marketing/content-timeline"
import { cn } from "@/lib/utils"
import { ContentTimelineChannelIcon } from "./ContentTimelineChannelIcon"

interface ContentTimelineBoardProps {
  items: ContentTimelineItem[]
  selectedId: string | null
  onSelect: (id: string) => void
}

function itemDate(item: ContentTimelineItem): Date {
  return parseISO(item.publishDate || item.startDate)
}

export function ContentTimelineBoard({ items, selectedId, onSelect }: ContentTimelineBoardProps) {
  const columns = useMemo(() => {
    return CONTENT_TIMELINE_STATUSES.map((status) => {
      const colItems = items
        .filter((i) => i.status === status.value)
        .sort((a, b) => itemDate(a).getTime() - itemDate(b).getTime())
      return { ...status, items: colItems }
    }).filter((c) => c.items.length > 0)
  }, [items])

  return (
    <div className="flex min-h-0 flex-1 items-start gap-3 overflow-x-auto p-3">
      {columns.map((col) => {
        const status = getContentTimelineStatusClasses(col.value as ContentTimelineStatus)
        return (
          <div
            key={col.value}
            className="flex w-[268px] flex-none flex-col rounded-2xl border border-border/50 bg-muted/30"
          >
            <div className="flex items-center gap-2 px-3.5 pb-2.5 pt-3">
              <span className={cn("h-2.5 w-2.5 rounded-full", status.legend)} />
              <span className="text-[11px] font-bold uppercase tracking-[0.04em] text-foreground">{col.label}</span>
              <span className="ml-auto rounded-full border border-border/60 bg-white px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                {col.items.length}
              </span>
            </div>
            <div className="flex flex-col gap-2.5 px-2.5 pb-3">
              {col.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelect(item.id)}
                  className={cn(
                    "overflow-hidden rounded-xl border bg-white p-3 text-left shadow-[0_1px_2px_rgba(31,42,68,0.05)] transition-all hover:-translate-y-0.5 hover:shadow-[0_10px_22px_rgba(31,42,68,0.13)]",
                    item.id === selectedId ? "border-[#005b8f] ring-1 ring-[#005b8f]" : "border-border/60"
                  )}
                >
                  <span className="mb-2 inline-flex items-center gap-1.5">
                    <ContentTimelineChannelIcon channel={item.channel} />
                    <span className="text-[10.5px] font-semibold text-muted-foreground">{item.theme}</span>
                  </span>
                  <div className="line-clamp-2 text-[12.5px] font-medium leading-snug text-foreground">{item.title}</div>
                  <div className="mt-2.5 flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {format(itemDate(item), "d MMM · HH:mm")}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
