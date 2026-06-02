"use client"

import type { ThingsToDoView } from "@/lib/marketing/things-to-do"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

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
  const currentLabel = TABS.find((tab) => tab.value === view)?.label ?? "List"

  return (
    <div
      className="flex items-center justify-between gap-2 border-b border-border/40 px-4 md:px-5"
      role="tablist"
      aria-label="Things to do views"
    >
      <button
        type="button"
        role="tab"
        aria-selected={true}
        onClick={() => onViewChange("list")}
        className={cn(
          "relative flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-colors",
          "text-foreground after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-primary"
        )}
      >
        List
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="rounded-md border border-border/40 px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
            aria-label="Other views"
          >
            View: {currentLabel}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {TABS.filter((tab) => tab.value !== "list").map((tab) => (
            <DropdownMenuItem
              key={tab.value}
              disabled
              className="flex items-center justify-between gap-2"
            >
              {tab.label}
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                Soon
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
