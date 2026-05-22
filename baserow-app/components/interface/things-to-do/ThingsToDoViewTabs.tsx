"use client"

import type { ThingsToDoView } from "@/lib/marketing/things-to-do"
import { cn } from "@/lib/utils"

const TABS: { value: ThingsToDoView; label: string; comingSoon?: boolean }[] = [
  { value: "list", label: "List" },
  { value: "board", label: "Board", comingSoon: true },
  { value: "by-priority", label: "By priority", comingSoon: true },
  { value: "by-campaign", label: "By campaign", comingSoon: true },
  { value: "calendar", label: "Calendar", comingSoon: true },
]

interface ThingsToDoViewTabsProps {
  view: ThingsToDoView
  onViewChange: (view: ThingsToDoView) => void
}

export function ThingsToDoViewTabs({ view, onViewChange }: ThingsToDoViewTabsProps) {
  return (
    <div
      className="flex flex-wrap gap-1 border-b border-border/40 px-4 md:px-5"
      role="tablist"
      aria-label="Things to do views"
    >
      {TABS.map((tab) => {
        const isActive = view === tab.value
        const isDisabled = tab.comingSoon === true

        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-disabled={isDisabled}
            disabled={isDisabled}
            onClick={() => {
              if (!isDisabled) onViewChange(tab.value)
            }}
            className={cn(
              "relative flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-colors",
              isActive
                ? "text-foreground after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-primary"
                : "text-muted-foreground hover:text-foreground",
              isDisabled && "cursor-not-allowed opacity-60 hover:text-muted-foreground"
            )}
          >
            {tab.label}
            {tab.comingSoon ? (
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                Soon
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
