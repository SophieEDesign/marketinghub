"use client"

import { Card, CardContent } from "@/components/ui/card"
import type { TableField } from "@/types/fields"
import type { HighlightRule } from "@/lib/interface/types"
import { evaluateHighlightRules, getFormattingStyle } from "@/lib/conditional-formatting/evaluator"

export interface TimelineEventCardEvent {
  id: string
  rowId: string
  title: string
  rowData: Record<string, any>
  color?: string
  image?: string
}

interface TimelineEventCardProps {
  event: TimelineEventCardEvent
  left: number
  width: number
  top: number
  /** Display title (single line, truncated in UI) */
  title: string
  /** Color for status indicator / left border */
  color?: string
  /** Optional single tag pill (max 1) */
  tag?: string
  /** Tooltip content - additional fields for hover */
  tooltipContent?: string
  /** Compact mode: 28px height when true, 40px when false */
  compactMode: boolean
  tableFields: TableField[]
  highlightRules?: HighlightRule[] | null
  selectedEventId: string | null
  isDragging: boolean
  isResizing: boolean
  draggingOrResizingAny: boolean
  onDragStart: (e: React.MouseEvent) => void
  onSelect: (e: React.MouseEvent) => void
  onResizeStart: (edge: "start" | "end", e: React.MouseEvent) => void
}

export default function TimelineEventCard({
  event,
  left,
  width,
  top,
  title,
  color,
  tag,
  tooltipContent,
  compactMode,
  tableFields,
  highlightRules,
  selectedEventId,
  isDragging,
  isResizing,
  draggingOrResizingAny,
  onDragStart,
  onSelect,
  onResizeStart,
}: TimelineEventCardProps) {
  const matchingRule =
    highlightRules && highlightRules.length > 0
      ? evaluateHighlightRules(highlightRules, event.rowData, tableFields)
      : null
  const rowFormattingStyle =
    matchingRule && matchingRule.scope !== "group"
      ? getFormattingStyle(matchingRule)
      : {}

  const effectiveColor = color ?? event.color
  const baseCardStyle = {
    borderLeftColor: effectiveColor,
    backgroundColor: effectiveColor ? `${effectiveColor}15` : "white",
    outline: selectedEventId === event.rowId ? "2px solid rgba(96, 165, 250, 0.4)" : "none",
    outlineOffset: selectedEventId === event.rowId ? "2px" : "0",
    ...rowFormattingStyle,
  }

  const tooltip = tooltipContent ? `${title}\n\n${tooltipContent}` : title

  const cardHeightClass = compactMode ? "h-7" : "h-10"
  const cardPaddingClass = compactMode ? "px-2 py-1" : "px-2 py-1.5"

  return (
    <div
      className="absolute group"
      data-timeline-event="true"
      style={{
        left: `${left}px`,
        width: `${width}px`,
        top: `${top}px`,
      }}
    >
      <Card
        className={`${cardHeightClass} shadow-sm transition-all hover:shadow-md ${
          effectiveColor ? "border-l-4" : ""
        } ${isDragging || isResizing ? "opacity-75" : ""} ${
          draggingOrResizingAny ? "cursor-grabbing" : "cursor-pointer"
        }`}
        style={baseCardStyle}
        onMouseDown={onDragStart}
        onClick={onSelect}
        title={tooltip}
      >
        <CardContent
          className={`${cardPaddingClass} h-full flex items-center gap-2 min-w-0 overflow-hidden`}
        >
          <div
            className="absolute left-0 top-0 bottom-0 w-4 cursor-ew-resize hover:bg-blue-300/50 opacity-0 group-hover:opacity-100 transition-opacity z-10 rounded-l"
            onMouseDown={(e) => onResizeStart("start", e)}
            style={{ marginLeft: "-4px" }}
            title="Drag to resize start date"
            data-timeline-resize="true"
          />

          {effectiveColor && (
            <div
              className="flex-shrink-0 w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: effectiveColor }}
              aria-hidden
            />
          )}

          <div className="flex-1 min-w-0 text-xs font-medium truncate whitespace-nowrap">
            {title || "—"}
          </div>

          {tag && (
            <span className="flex-shrink-0 px-2 py-0.5 rounded-md text-[10px] font-medium bg-gray-100 text-gray-700 truncate max-w-[80px]">
              {tag}
            </span>
          )}

          <div
            className="absolute right-0 top-0 bottom-0 w-4 cursor-ew-resize hover:bg-blue-300/50 opacity-0 group-hover:opacity-100 transition-opacity z-10 rounded-r"
            onMouseDown={(e) => onResizeStart("end", e)}
            style={{ marginRight: "-4px" }}
            title="Drag to resize end date"
            data-timeline-resize="true"
          />
        </CardContent>
      </Card>
    </div>
  )
}
