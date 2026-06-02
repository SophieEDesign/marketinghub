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
  onOpenRecord?: () => void
}

export function ThingsToDoRow({
  item,
  selected,
  compact,
  checked,
  onSelect,
  onCheckedChange,
  onOpenRecord,
}: ThingsToDoRowProps) {
  const group = assignRowGroup(item)
  const { row } = getRowGroupClasses(group)
  const dueLabel = formatDueDateDisplay(item.dueDate)
  const isOverdue = group === "overdue"
  const isToday = group === "due-today"
  const linkedLabel = item.campaign?.title ?? item.linkedItems?.[0]?.title

  return (
    <article
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
        "cursor-pointer rounded-xl border border-border/50 bg-background p-3 transition-colors",
        row,
        compact && "p-2.5",
        selected && "border-primary/40 ring-1 ring-inset ring-primary/30"
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className="mt-0.5 shrink-0"
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
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{item.title}</p>
              {item.description ? (
                <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{item.description}</p>
              ) : null}
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <span
                className={cn(
                  "text-xs font-medium tabular-nums",
                  isOverdue && "text-red-600",
                  isToday && "text-amber-600",
                  !isOverdue && !isToday && "text-muted-foreground"
                )}
              >
                {dueLabel}
              </span>
              <ThingsToDoStatusBadge status={item.status} />
            </div>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            {item.contentType ? <span>{item.contentType}</span> : null}
            {linkedLabel ? (
              <span className="inline-flex min-w-0 items-center gap-1">
                <Megaphone className="h-3 w-3 shrink-0 opacity-60" />
                <span className="max-w-[180px] truncate">{linkedLabel}</span>
              </span>
            ) : null}
            {item.owner ? (
              <span className="inline-flex items-center gap-1">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
                  {item.owner.initials}
                </span>
                <span className="hidden sm:inline">{item.owner.name}</span>
              </span>
            ) : null}
          </div>

          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <ThingsToDoTypeBadge type={item.type} />
              <ThingsToDoPriorityBadge priority={item.priority} />
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
                    className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-background/80 hover:text-foreground"
                    aria-label="More actions"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() =>
                      onOpenRecord ? onOpenRecord() : debugLog(`[ThingsToDo] Open: ${item.title}`)
                    }
                    disabled={!onOpenRecord && !item.recordTableId}
                  >
                    Open record
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => debugLog(`[ThingsToDo] Copy link: ${item.id}`)}>
                    Copy link
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>
    </article>
  )
}
