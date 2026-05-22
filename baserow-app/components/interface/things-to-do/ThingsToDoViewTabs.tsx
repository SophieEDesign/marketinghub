"use client"

import type { ThingsToDoView } from "@/lib/marketing/things-to-do"
import { cn } from "@/lib/utils"

const TABS: { value: ThingsToDoView; label: string }[] = [
  { value: "list", label: "List" },
  { value: "board", label: "Board" },
  { value: "by-priority", label: "By priority" },
  { value: "by-campaign", label: "By campaign" },
  { value: "calendar", label: "Calendar" },
]

interface ThingsToDoViewTabsProps {
  view: ThingsToDoView
  onViewChange: (view: ThingsToDoView) => void
}

export function ThingsToDoViewTabs({ view, onViewChange }: ThingsToDoViewTabsProps) {
  return (
    <div className="flex flex-wrap gap-1 border-b border-border/40 px-4 md:px-5">
      {TABS.map((tab) => (
        <button
          key={tab.value}
          type="button"
          onClick={() => onViewChange(tab.value)}
          className={cn(
            "relative px-3 py-2.5 text-sm font-medium transition-colors",
            view === tab.value
              ? "text-foreground after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-primary"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
