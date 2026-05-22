"use client"

import type {
  ThingsToDoRowGroup,
  ThingsToDoRowGroupSection,
  ThingsToDoItem,
} from "@/lib/marketing/things-to-do"
import { getRowGroupClasses, isThingsToDoRowGroup } from "@/lib/marketing/things-to-do"
import { cn } from "@/lib/utils"
import { ThingsToDoRow } from "./ThingsToDoRow"

interface ThingsToDoGroupedListProps {
  sections: ThingsToDoRowGroupSection[]
  selectedId: string | null
  compact?: boolean
  checkedIds: Set<string>
  onSelect: (id: string) => void
  onCheckedChange: (id: string, checked: boolean) => void
}

export function ThingsToDoGroupedList({
  sections,
  selectedId,
  compact,
  checkedIds,
  onSelect,
  onCheckedChange,
}: ThingsToDoGroupedListProps) {
  if (sections.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
        No items match your filters.
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {sections.map((section) => {
        const { dot, section: sectionBg } = isThingsToDoRowGroup(String(section.key))
          ? getRowGroupClasses(section.key as ThingsToDoRowGroup)
          : {
              dot: "bg-muted-foreground/60",
              section: "bg-muted/40",
            }
        return (
          <section key={String(section.key)} className="mb-1">
            <div
              className={cn(
                "sticky top-0 z-[1] flex items-center gap-2 px-4 py-2 text-xs font-semibold text-foreground",
                sectionBg
              )}
            >
              <span className={cn("h-2 w-2 shrink-0 rounded-full", dot)} />
              <span>
                {section.label} ({section.count})
              </span>
            </div>
            <div className="divide-y divide-border/20">
              {section.items.map((item: ThingsToDoItem) => (
                <ThingsToDoRow
                  key={item.id}
                  item={item}
                  selected={selectedId === item.id}
                  compact={compact}
                  checked={checkedIds.has(item.id)}
                  onSelect={() => onSelect(item.id)}
                  onCheckedChange={(c) => onCheckedChange(item.id, c)}
                />
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
