"use client"

import type { ContentTimelineItem, TimelineItemPosition } from "@/lib/marketing/content-timeline"
import {
  formatDisplayDate,
  getThemeStyles,
  ownerInitials,
} from "@/lib/marketing/content-timeline"
import { cn } from "@/lib/utils"
import { ContentTimelineChannelIcon } from "./ContentTimelineChannelIcon"
import { ContentTimelineStatusBadge } from "./ContentTimelineStatusBadge"
import { ContentTimelineTypeIcon } from "./ContentTimelineTypeIcon"

interface ContentTimelineItemBarProps {
  item: ContentTimelineItem
  position: TimelineItemPosition
  selected: boolean
  compact: boolean
  showStatusBadge: boolean
  showOwnerInitials: boolean
  onSelect: (id: string) => void
}

export function ContentTimelineItemBar({
  item,
  position,
  selected,
  compact,
  showStatusBadge,
  showOwnerInitials,
  onSelect,
}: ContentTimelineItemBarProps) {
  const theme = getThemeStyles(item.theme)
  const endLabel = item.endDate ?? item.publishDate ?? item.startDate
  const tooltip = `${item.title}\n${formatDisplayDate(item.startDate)} – ${formatDisplayDate(endLabel)}\n${item.theme}`

  return (
    <button
      type="button"
      title={tooltip}
      onClick={(e) => {
        e.stopPropagation()
        onSelect(item.id)
      }}
      className={cn(
        "absolute top-1/2 z-[2] flex -translate-y-1/2 items-center gap-1 overflow-hidden rounded-full border px-2 text-left shadow-sm transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
        theme.barBg,
        theme.barBorder,
        position.isSingleDay ? "min-w-[72px]" : "min-w-[100px]",
        compact ? "h-6 text-[10px]" : "h-7 text-xs",
        selected && "ring-2 ring-blue-500 ring-offset-1"
      )}
      style={{
        left: `${position.leftPct}%`,
        width: `${position.widthPct}%`,
        maxWidth: position.isSingleDay ? "120px" : undefined,
      }}
    >
      <span className={cn("w-0.5 shrink-0 self-stretch rounded-full", theme.strip)} aria-hidden />
      <ContentTimelineTypeIcon type={item.type} />
      <ContentTimelineChannelIcon channel={item.channel} />
      <span className="min-w-0 flex-1 truncate font-medium text-foreground">{item.title}</span>
      {showStatusBadge && (
        <ContentTimelineStatusBadge status={item.status} className="hidden sm:inline-flex" />
      )}
      {showOwnerInitials && item.owner && (
        <span
          className="hidden h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/80 text-[9px] font-semibold text-muted-foreground md:flex"
          title={item.owner}
        >
          {ownerInitials(item.owner)}
        </span>
      )}
    </button>
  )
}
