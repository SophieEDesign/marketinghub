"use client"

import { MoreHorizontal, Megaphone } from "lucide-react"
import {
  assignRowGroup,
  formatDueDateDisplay,
  getRowGroupClasses,
  type ThingsToDoItem,
} from "@/lib/marketing/things-to-do"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { debugLog } from "@/lib/debug"
import {
  ThingsToDoPriorityBadge,
  ThingsToDoStatusBadge,
  ThingsToDoTypeBadge,
} from "./ThingsToDoBadges"

interface ThingsToDoRowProps {
  item: ThingsToDoItem
  selected: boolean
  compact?: boolean
  checked?: boolean
  onSelect: () => void
  onCheckedChange?: (checked: boolean) => void
}

export function ThingsToDoRow({
  item,
  selected,
  compact,
  checked,
  onSelect,
  onCheckedChange,
}: ThingsToDoRowProps) {
  const group = assignRowGroup(item)
  const { row } = getRowGroupClasses(group)
  const dueLabel = formatDueDateDisplay(item.dueDate)
  const isOverdue = group === "overdue"
  const isToday = group === "due-today"
  const linkedLabel = item.campaign?.title ?? item.linkedItems?.[0]?.title

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`View task: ${item.title}`}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onSelect()
        }
      }}
      className={cn(
        "flex cursor-pointer items-center gap-3 px-3 transition-colors",
        row,
        compact ? "py-2" : "py-3",
        selected && "ring-1 ring-inset ring-primary/30"
      )}
    >
      <div
        className="shrink-0"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <Checkbox
          checked={checked}
          onCheckedChange={(v) => onCheckedChange?.(v === true)}
          aria-label={`Mark ${item.title} complete`}
        />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="text-sm font-medium text-foreground">{item.title}</span>
          {item.contentType ? (
            <span className="text-xs text-muted-foreground">{item.contentType}</span>
          ) : null}
        </div>
        {linkedLabel ? (
          <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
            <Megaphone className="h-3 w-3 shrink-0 opacity-60" />
            <span className="truncate">{linkedLabel}</span>
          </div>
        ) : null}
      </div>

      <div className="hidden shrink-0 items-center gap-1.5 sm:flex">
        <ThingsToDoTypeBadge type={item.type} />
        <ThingsToDoPriorityBadge priority={item.priority} />
      </div>

      {item.owner ? (
        <div
          className="hidden h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground md:flex"
          title={item.owner.name}
        >
          {item.owner.initials}
        </div>
      ) : null}

      <span
        className={cn(
          "hidden shrink-0 text-xs font-medium tabular-nums lg:block",
          isOverdue && "text-red-600",
          isToday && "text-amber-600",
          !isOverdue && !isToday && "text-muted-foreground"
        )}
      >
        {dueLabel}
      </span>

      <div className="hidden shrink-0 sm:block">
        <ThingsToDoStatusBadge status={item.status} />
      </div>

      <div
        className="shrink-0"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-background/80 hover:text-foreground"
              aria-label="More actions"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => debugLog(`[ThingsToDo] Open: ${item.title}`)}
            >
              Open record
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => debugLog(`[ThingsToDo] Copy link: ${item.id}`)}
            >
              Copy link
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
