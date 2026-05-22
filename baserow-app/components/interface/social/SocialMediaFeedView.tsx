"use client"

import DashboardEmpty from "@/components/interface/primitives/DashboardEmpty"
import { SocialPostCard } from "@/components/interface/social/SocialPostCard"
import type { SocialCalendarItem } from "@/lib/marketing/social-media-calendar"
import { cn } from "@/lib/utils"

export function SocialMediaFeedView({
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
        title="No posts to preview"
        description="Try changing filters or switching to all content."
        className="py-12"
      />
    )
  }

  return (
    <div
      className={cn(
        "grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 min-h-0 overflow-y-auto pr-1",
        compact ? "max-h-[420px]" : "max-h-[min(68vh,580px)]"
      )}
    >
      {sorted.map((item) => (
        <SocialPostCard
          key={item.id}
          item={item}
          selected={selectedId === item.id}
          onClick={() => onSelect(item.id)}
          showPlatformIcons={showPlatformIcons}
          showApprovalStatus={showApprovalStatus}
        />
      ))}
    </div>
  )
}
