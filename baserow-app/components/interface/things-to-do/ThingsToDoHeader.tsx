"use client"

import { CheckSquare, Plus } from "lucide-react"
import type { ThingsToDoStats } from "@/lib/marketing/things-to-do"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { debugLog } from "@/lib/debug"

interface ThingsToDoHeaderProps {
  title: string
  subtitle: string
  stats: ThingsToDoStats
  showStats: boolean
  showAddButton?: boolean
}

const STAT_CARDS: {
  key: keyof ThingsToDoStats
  label: string
  valueClass: string
}[] = [
  { key: "overdue", label: "Overdue", valueClass: "text-red-600" },
  { key: "dueToday", label: "Due today", valueClass: "text-amber-600" },
  { key: "dueThisWeek", label: "Due this week", valueClass: "text-blue-600" },
  { key: "waiting", label: "Waiting", valueClass: "text-purple-600" },
  { key: "completed", label: "Completed", valueClass: "text-green-600" },
]

export function ThingsToDoHeader({
  title,
  subtitle,
  stats,
  showStats,
  showAddButton = false,
}: ThingsToDoHeaderProps) {
  const handleAdd = () => {
    // TODO: connect work items to a Marketing Hub tasks/actions table.
    debugLog("[ThingsToDo] Add item")
  }

  return (
    <header className="shrink-0 border-b border-border/40 px-4 py-4 md:px-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <CheckSquare className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">{title}</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
          </div>
        </div>
        {showAddButton ? (
          <Button type="button" size="sm" className="shrink-0" onClick={handleAdd}>
            <Plus className="mr-1.5 h-4 w-4" />
            Add item
          </Button>
        ) : null}
      </div>

      {showStats ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {STAT_CARDS.map(({ key, label, valueClass }) => (
            <div
              key={key}
              className="min-w-[88px] rounded-xl border border-border/30 bg-muted/30 px-3 py-2"
            >
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {label}
              </p>
              <p className={cn("text-xl font-semibold tabular-nums", valueClass)}>{stats[key]}</p>
            </div>
          ))}
        </div>
      ) : null}
    </header>
  )
}
