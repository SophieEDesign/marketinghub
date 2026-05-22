"use client"

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
  return (
    <div
      className={cn(
        "flex gap-2 overflow-x-auto border-b border-border/60 bg-muted/10 px-3 py-2 md:hidden",
        className
      )}
    >
      {HUB_CATEGORY_OPTIONS.map((opt) => {
        const active = category === opt.id
        const count = counts[opt.id] ?? 0
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onCategoryChange(opt.id)}
            className={cn(
              "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              active
                ? "bg-blue-600 text-white"
                : "bg-background border border-border/60 text-foreground/80"
            )}
          >
            {opt.label} ({count})
          </button>
        )
      })}
    </div>
  )
}
