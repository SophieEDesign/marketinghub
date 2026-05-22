"use client"

import { format, isSameDay } from "date-fns"
import DashboardEmpty from "@/components/interface/primitives/DashboardEmpty"
import { SocialPostCard } from "@/components/interface/social/SocialPostCard"
import type { SocialCalendarItem } from "@/lib/marketing/social-media-calendar"
import { cn } from "@/lib/utils"

export function SocialMediaListView({
  items,
  selectedId,
  onSelect,
  compact = false,
  showPlatformIcons = true,
  showApprovalStatus = true,
}: {
  items: SocialCalendarItem[]
  selectedId: string | null
  onSelect: (id: string) => void
  compact?: boolean
  showPlatformIcons?: boolean
  showApprovalStatus?: boolean
}) {
  const sorted = [...items]
    .filter((i) => i.date ?? i.dueDate)
    .sort((a, b) => {
      const da = a.date ?? a.dueDate!
      const db = b.date ?? b.dueDate!
      return da.getTime() - db.getTime()
    })

  if (sorted.length === 0) {
    return (
      <DashboardEmpty
        title="No posts in this period"
        description="Adjust filters or add a new social post."
        className="py-12"
      />
    )
  }

  const groups: { day: Date; items: SocialCalendarItem[] }[] = []
  for (const item of sorted) {
    const d = item.date ?? item.dueDate!
    const last = groups[groups.length - 1]
    if (last && isSameDay(last.day, d)) {
      last.items.push(item)
    } else {
      groups.push({ day: d, items: [item] })
    }
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-4 min-h-0 overflow-y-auto pr-1",
        compact ? "max-h-[420px]" : "max-h-[min(68vh,580px)]"
      )}
    >
      {groups.map((group) => (
        <section key={group.day.toISOString()}>
          <h3 className="text-xs font-semibold text-muted-foreground mb-2 sticky top-0 bg-background/90 py-1 backdrop-blur-sm z-[1]">
            {format(group.day, "EEEE, d MMMM yyyy")}
          </h3>
          <ul className="flex flex-col gap-2">
            {group.items.map((item) => (
              <li key={item.id}>
                <SocialPostCard
                  item={item}
                  compact
                  selected={selectedId === item.id}
                  onClick={() => onSelect(item.id)}
                  showPlatformIcons={showPlatformIcons}
                  showApprovalStatus={showApprovalStatus}
                />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
