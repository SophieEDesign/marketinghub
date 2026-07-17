"use client"

import { Folder, Star } from "lucide-react"
import { cn } from "@/lib/utils"
import { HUB_CATEGORY_OPTIONS, type CategoryFilter } from "./types"

interface CategoryPillsProps {
  category: CategoryFilter
  counts: Record<CategoryFilter, number>
  onCategoryChange: (c: CategoryFilter) => void
  className?: string
}

export default function CategoryPills({
  category,
  counts,
  onCategoryChange,
  className,
}: CategoryPillsProps) {
  const topItems: { id: CategoryFilter; label: string; icon: React.ElementType }[] = [
    { id: "all", label: "All", icon: Folder },
    { id: "favourites", label: "Favourites", icon: Star },
  ]

  return (
    <div
      className={cn(
        "flex gap-2 overflow-x-auto border-b border-[#e4e7ec] bg-white px-4 py-3 md:px-8",
        className
      )}
    >
      {[...topItems, ...HUB_CATEGORY_OPTIONS.filter((o) => o.id !== "all")].map((opt) => {
        const active = category === opt.id
        const count = counts[opt.id] ?? 0
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onCategoryChange(opt.id)}
            className={cn(
              "shrink-0 rounded-full px-3 py-2 text-xs font-medium transition-colors min-h-11",
              active
                ? "bg-hub-primary text-white"
                : "border border-[#e4e7ec] bg-white text-[#1f2a44]/85"
            )}
          >
            {opt.label} ({count})
          </button>
        )
      })}
    </div>
  )
}
