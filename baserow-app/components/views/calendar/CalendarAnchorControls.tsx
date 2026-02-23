"use client"

import { Button } from "@/components/ui/button"
import {
  getStartOfWeek,
  getStartOfMonth,
  getStartOfNextWeek,
  getStartOfNextMonth,
} from "@/lib/calendar-anchor-utils"
import { startOfDay } from "date-fns"

export type AnchorPreset = "today" | "thisWeek" | "nextWeek" | "thisMonth" | "nextMonth"

const PRESET_LABELS: Record<AnchorPreset, string> = {
  today: "Today",
  thisWeek: "This Week",
  nextWeek: "Next Week",
  thisMonth: "This Month",
  nextMonth: "Next Month",
}

export function getTargetDateForPreset(preset: AnchorPreset): Date {
  const today = startOfDay(new Date())
  switch (preset) {
    case "today":
      return today
    case "thisWeek":
      return getStartOfWeek(today)
    case "nextWeek":
      return getStartOfNextWeek(today)
    case "thisMonth":
      return getStartOfMonth(today)
    case "nextMonth":
      return getStartOfNextMonth(today)
    default:
      return today
  }
}

export interface CalendarAnchorControlsProps {
  onScrollToDate: (date: Date) => void
  disabled?: boolean
  compact?: boolean
}

export default function CalendarAnchorControls({
  onScrollToDate,
  disabled = false,
  compact = false,
}: CalendarAnchorControlsProps) {
  const presets: AnchorPreset[] = [
    "today",
    "thisWeek",
    "nextWeek",
    "thisMonth",
    "nextMonth",
  ]

  return (
    <div className={compact ? "flex items-center gap-1 flex-wrap" : "flex items-center gap-2 flex-wrap"}>
      {presets.map((preset) => (
        <Button
          key={preset}
          variant="ghost"
          size="sm"
          disabled={disabled}
          className={compact ? "text-xs h-7 px-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100" : "text-xs h-7"}
          onClick={() => onScrollToDate(getTargetDateForPreset(preset))}
        >
          {PRESET_LABELS[preset]}
        </Button>
      ))}
    </div>
  )
}
