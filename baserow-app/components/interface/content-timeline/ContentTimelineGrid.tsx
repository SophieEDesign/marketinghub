"use client"

import { useMemo } from "react"
import {
  buildTimelineColumns,
  getThemeStyles,
  getTodayMarkerPct,
  groupTimelineItems,
  positionItemOnTimeline,
  type ContentTimelineGroupBy,
  type ContentTimelineItem,
  type ContentTimelineView,
} from "@/lib/marketing/content-timeline"
import { cn } from "@/lib/utils"
import { ContentTimelineItemBar } from "./ContentTimelineItemBar"

const GROUP_COL_WIDTH = 180
const MIN_TIMELINE_WIDTH = 720

interface ContentTimelineGridProps {
  items: ContentTimelineItem[]
  view: ContentTimelineView
  anchorDate: Date
  groupBy: ContentTimelineGroupBy
  selectedId: string | null
  compact: boolean
  showStatusBadges: boolean
  showOwnerInitials: boolean
  onSelect: (id: string) => void
}

export function ContentTimelineGrid({
  items,
  view,
  anchorDate,
  groupBy,
  selectedId,
  compact,
  showStatusBadges,
  showOwnerInitials,
  onSelect,
}: ContentTimelineGridProps) {
  const columns = useMemo(() => buildTimelineColumns(view, anchorDate), [view, anchorDate])
  const groups = useMemo(() => groupTimelineItems(items, groupBy), [items, groupBy])
  const todayPct = useMemo(() => getTodayMarkerPct(columns), [columns])

  const rowHeight = compact ? 40 : 52

  return (
    <div className="min-h-0 min-w-0 overflow-auto">
      <div
        className="relative"
        style={{ minWidth: `min(100%, ${GROUP_COL_WIDTH + MIN_TIMELINE_WIDTH}px)` }}
      >
        {/* Sticky header */}
        <div className="sticky top-0 z-20 flex border-b border-border/50 bg-background/95 backdrop-blur-sm">
          <div
            className="sticky left-0 z-30 shrink-0 border-r border-border/40 bg-background/95 px-3 py-2"
            style={{ width: GROUP_COL_WIDTH }}
          >
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {groupBy === "theme" ? "Theme" : groupBy === "channel" ? "Channel" : groupBy === "status" ? "Status" : "Owner"}
            </span>
          </div>
          <div className="relative flex flex-1">
            {columns.map((col) => (
              <div
                key={col.id}
                className="flex-1 min-w-[56px] border-r border-border/30 px-1 py-2 text-center"
              >
                <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {col.label}
                </div>
                {col.sublabel && (
                  <div className="text-[9px] text-muted-foreground/80">{col.sublabel}</div>
                )}
              </div>
            ))}
            {todayPct != null && (
              <div
                className="pointer-events-none absolute top-0 bottom-0 z-10 border-l-2 border-dashed border-blue-400"
                style={{ left: `${todayPct}%` }}
                aria-hidden
              />
            )}
          </div>
        </div>

        {/* Rows */}
        {groups.map((group) => {
          const themeStyle = groupBy === "theme" ? getThemeStyles(group.key) : null
          return (
            <div
              key={group.key}
              className={cn("flex border-b border-border/30", themeStyle?.rowBg)}
              style={{ minHeight: rowHeight }}
            >
              <div
                className="sticky left-0 z-10 flex shrink-0 items-center gap-2 border-r border-border/40 bg-background/90 px-3"
                style={{ width: GROUP_COL_WIDTH }}
              >
                {themeStyle && (
                  <span className={cn("h-2 w-2 shrink-0 rounded-full", themeStyle.dot)} aria-hidden />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-foreground">{group.label}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {group.items.length} {group.items.length === 1 ? "item" : "items"}
                  </p>
                </div>
              </div>
              <div className="relative flex flex-1" style={{ minHeight: rowHeight }}>
                {columns.map((col) => (
                  <div
                    key={col.id}
                    className="flex-1 min-w-[56px] border-r border-border/20"
                    aria-hidden
                  />
                ))}
                {todayPct != null && (
                  <div
                    className="pointer-events-none absolute top-0 bottom-0 z-[1] border-l-2 border-dashed border-blue-400/70"
                    style={{ left: `${todayPct}%` }}
                    aria-hidden
                  />
                )}
                {group.items.map((item) => {
                  const position = positionItemOnTimeline(item, columns)
                  if (!position) return null
                  return (
                    <ContentTimelineItemBar
                      key={item.id}
                      item={item}
                      position={position}
                      selected={selectedId === item.id}
                      compact={compact}
                      showStatusBadge={showStatusBadges}
                      showOwnerInitials={showOwnerInitials}
                      onSelect={onSelect}
                    />
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
