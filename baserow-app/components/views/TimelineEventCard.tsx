"use client"

import { Card, CardContent } from "@/components/ui/card"
import TimelineFieldValue from "./TimelineFieldValue"
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

interface ResolvedCardFields {
  cardFields: TableField[]
}

interface TimelineEventCardProps {
  event: TimelineEventCardEvent
  left: number
  width: number
  top: number
  rowSizeSpacing: { cardHeight: string; cardPadding: string }
  wrapTitle: boolean
  resolvedCardFields: ResolvedCardFields
  linkedValueLabelMaps: Record<string, Record<string, string>>
  tableFields: TableField[]
  highlightRules?: HighlightRule[] | null
  fitImageSize: boolean
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
  rowSizeSpacing,
  wrapTitle,
  resolvedCardFields,
  linkedValueLabelMaps,
  tableFields,
  highlightRules,
  fitImageSize,
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

  const baseCardStyle = {
    borderLeftColor: event.color,
    backgroundColor: event.color ? `${event.color}15` : "white",
    outline: selectedEventId === event.rowId ? "2px solid rgba(96, 165, 250, 0.4)" : "none",
    outlineOffset: selectedEventId === event.rowId ? "2px" : "0",
    ...rowFormattingStyle,
  }

  return (
    <div
      className="absolute group"
      style={{
        left: `${left}px`,
        width: `${width}px`,
        top: `${top}px`,
      }}
    >
      <Card
        className={`${rowSizeSpacing.cardHeight} shadow-sm transition-all hover:shadow-md ${
          event.color ? "border-l-4" : ""
        } ${isDragging || isResizing ? "opacity-75" : ""} ${
          draggingOrResizingAny ? "cursor-grabbing" : "cursor-pointer"
        }`}
        style={baseCardStyle}
        onMouseDown={onDragStart}
        onClick={onSelect}
      >
        <CardContent
          className={`${rowSizeSpacing.cardPadding} h-full flex flex-col relative gap-1 min-w-0`}
        >
          {event.image && (
            <div
              className={`flex-shrink-0 w-6 h-6 rounded overflow-hidden bg-gray-100 ${
                fitImageSize ? "object-contain" : "object-cover"
              }`}
            >
              <img
                src={event.image}
                alt=""
                className={`w-full h-full ${fitImageSize ? "object-contain" : "object-cover"}`}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none"
                }}
              />
            </div>
          )}

          <div
            className="absolute left-0 top-0 bottom-0 w-4 cursor-ew-resize hover:bg-blue-300/50 opacity-0 group-hover:opacity-100 transition-opacity z-10 rounded-l"
            onMouseDown={(e) => onResizeStart("start", e)}
            style={{ marginLeft: "-4px" }}
            title="Drag to resize start date"
            data-timeline-resize="true"
          />

          <div
            className={`text-xs font-medium leading-tight ${wrapTitle ? "break-words" : "truncate"}`}
            title={event.title}
          >
            {event.title}
          </div>

          {resolvedCardFields.cardFields.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-0.5 min-w-0">
              {resolvedCardFields.cardFields.slice(0, 3).map((field) => {
                const value = event.rowData[field.name]
                return (
                  <TimelineFieldValue
                    key={field.id}
                    field={field}
                    value={value}
                    valueLabelMap={
                      linkedValueLabelMaps[field.name] || linkedValueLabelMaps[field.id]
                    }
                    compact={true}
                  />
                )
              })}
            </div>
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
