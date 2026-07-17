"use client"

import { Search } from "lucide-react"
import type { ThingsToDoSort } from "@/lib/marketing/things-to-do"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

interface ThingsToDoListToolbarProps {
  searchQuery: string
  onSearchChange: (q: string) => void
  sortBy: ThingsToDoSort
  onSortChange: (sort: ThingsToDoSort) => void
  statusChip: string
  onStatusChipChange: (chip: string) => void
  totalCount: number
  compact?: boolean
}

const STATUS_CHIPS = [
  { value: "all", label: "All" },
  { value: "to-do", label: "To do" },
  { value: "in-progress", label: "In progress" },
  { value: "scheduled", label: "Scheduled" },
]

export function ThingsToDoListToolbar({
  searchQuery,
  onSearchChange,
  sortBy,
  onSortChange,
  statusChip,
  onStatusChipChange,
  totalCount,
  compact,
}: ThingsToDoListToolbarProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 border-b border-border/40 px-4 py-2 md:flex-row md:items-center md:justify-between md:px-5",
        compact && "py-1.5"
      )}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        {STATUS_CHIPS.map((chip) => (
          <button
            key={chip.value}
            type="button"
            onClick={() => onStatusChipChange(chip.value)}
            className={cn(
              "rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
              statusChip === chip.value
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            )}
          >
            {chip.label}
            {chip.value === "all" ? ` (${totalCount})` : ""}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[140px] flex-1 md:max-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search…"
            className="h-8 pl-8 text-xs"
            aria-label="Search work items"
          />
        </div>
        <Select value={sortBy} onValueChange={(v) => onSortChange(v as ThingsToDoSort)}>
          <SelectTrigger className="h-8 w-[130px] text-xs" aria-label="Sort by">
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="due-date">Due date</SelectItem>
            <SelectItem value="priority">Priority</SelectItem>
            <SelectItem value="status">Status</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
