// components/interface/content-timeline/ContentTimelineCalendar.tsx
"use client"

import { useMemo } from "react"
import {
  addDays,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns"
import { Plus } from "lucide-react"
import {
  getContentTimelineStatusClasses,
  getStatusLabel,
  type ContentTimelineItem,
} from "@/lib/marketing/content-timeline"
import { cn } from "@/lib/utils"
import { ContentTimelineChannelIcon } from "./ContentTimelineChannelIcon"

interface ContentTimelineCalendarProps {
  items: ContentTimelineItem[]
  anchorDate: Date
  selectedId: string | null
  maxPerDay?: number
  onSelect: (id: string) => void
  onAddOnDate?: (isoDate: string) => void
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

/** Date used to place an item on the calendar — publishDate first, else startDate. */
function itemDate(item: ContentTimelineItem): Date {
  return parseISO(item.publishDate || item.startDate)
}

export function ContentTimelineCalendar({
  items,
  anchorDate,
  selectedId,
  maxPerDay = 2,
  onSelect,
  onAddOnDate,
}: ContentTimelineCalendarProps) {
  const weeks = useMemo(() => {
    const gridStart = startOfWeek(startOfMonth(anchorDate), { weekStartsOn: 1 })
    const gridEnd = endOfWeek(endOfMonth(anchorDate), { weekStartsOn: 1 })
    const rows: Date[][] = []
    let cursor = gridStart
    while (cursor <= gridEnd) {
      const row: Date[] = []
      for (let i = 0; i < 7; i++) {
        row.push(cursor)
        cursor = addDays(cursor, 1)
      }
      rows.push(row)
    }
    return rows
  }, [anchorDate])

  const byDay = useMemo(() => {
    const map = new Map<string, ContentTimelineItem[]>()
    for (const item of items) {
      const key = format(itemDate(item), "yyyy-MM-dd")
      const list = map.get(key) ?? []
      list.push(item)
      map.set(key, list)
    }
    for (const list of map.values()) {
      list.sort((a, b) => itemDate(a).getTime() - itemDate(b).getTime())
    }
    return map
  }, [items])

  const today = new Date()

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto">
      {/* Weekday header */}
      <div className="grid grid-cols-7 border-b border-border/50">
        {WEEKDAYS.map((d) => (
          <div key={d} className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
            {d}
          </div>
        ))}
      </div>

      {/* Weeks */}
      <div className="flex-1">
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 border-b border-border/40">
            {week.map((day) => {
              const key = format(day, "yyyy-MM-dd")
              const dayItems = byDay.get(key) ?? []
              const inMonth = isSameMonth(day, anchorDate)
              const isToday = isSameDay(day, today)
              const shown = dayItems.slice(0, maxPerDay)
              const extra = dayItems.length - shown.length

              return (
                <div
                  key={key}
                  className={cn(
                    "group min-h-[148px] border-r border-border/40 p-1.5 last:border-r-0",
                    inMonth ? "bg-white" : "bg-muted/30"
                  )}
                >
                  <div className="mb-1.5 flex items-center justify-between">
                    <span
                      className={cn(
                        "flex h-[22px] min-w-[22px] items-center justify-center rounded-full px-1.5 text-xs",
                        isToday
                          ? "bg-[#005b8f] font-bold text-white"
                          : inMonth
                            ? "font-semibold text-foreground"
                            : "text-muted-foreground/60"
                      )}
                    >
                      {format(day, "d")}
                    </span>
                    {onAddOnDate && inMonth && (
                      <button
                        type="button"
                        onClick={() => onAddOnDate(key)}
                        aria-label={`Add post on ${format(day, "d MMM")}`}
                        className="opacity-0 transition-opacity group-hover:opacity-60 hover:!opacity-100"
                      >
                        <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5">
                    {shown.map((item) => (
                      <PostCard
                        key={item.id}
                        item={item}
                        selected={item.id === selectedId}
                        onSelect={onSelect}
                      />
                    ))}
                    {extra > 0 && (
                      <span className="px-1 text-[10px] font-semibold text-muted-foreground">+{extra} more</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

function PostCard({
  item,
  selected,
  onSelect,
}: {
  item: ContentTimelineItem
  selected: boolean
  onSelect: (id: string) => void
}) {
  const status = getContentTimelineStatusClasses(item.status)
  return (
    <button
      type="button"
      onClick={() => onSelect(item.id)}
      className={cn(
        "group/card overflow-hidden rounded-lg border bg-white text-left shadow-[0_1px_2px_rgba(31,42,68,0.05)] transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_18px_rgba(31,42,68,0.13)]",
        selected ? "border-[#005b8f] ring-1 ring-[#005b8f]" : "border-border/60"
      )}
    >
      <div className="px-2 py-1.5">
        <div className="mb-1 flex items-center justify-between gap-1">
          <span className="flex items-center gap-1.5">
            <ContentTimelineChannelIcon channel={item.channel} />
            <span className="text-[9.5px] font-semibold text-muted-foreground">
              {item.publishDate ? format(parseISO(item.publishDate), "HH:mm") : ""}
            </span>
          </span>
          <span className={cn("h-2 w-2 shrink-0 rounded-full", status.legend)} title={getStatusLabel(item.status)} />
        </div>
        <div className="line-clamp-2 text-[10.5px] font-medium leading-snug text-[#2c3340]">{item.title}</div>
      </div>
    </button>
  )
}
