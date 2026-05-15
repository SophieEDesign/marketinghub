"use client"

import { ChevronRight } from "lucide-react"
import type { HubCategoryDef } from "@/lib/marketing/internal-staff-hub"
import { cn } from "@/lib/utils"

interface CategoryCardProps {
  category: HubCategoryDef
  count: number
  active?: boolean
  onClick: () => void
}

export default function CategoryCard({ category, count, active, onClick }: CategoryCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex flex-col items-start gap-3 rounded-card-lg border border-border/45 bg-card p-4 text-left shadow-card",
        "transition-all duration-200 hover:shadow-card-hover hover:border-border/70 min-w-[140px] shrink-0 snap-start",
        active && "ring-2 ring-accent-link/30 border-accent-link/40"
      )}
    >
      <span
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-inner text-sm font-semibold",
          category.accentBg,
          category.accentClass
        )}
      >
        {category.label.charAt(0)}
      </span>
      <div className="min-w-0 w-full">
        <p className="text-sm font-medium text-foreground leading-snug">{category.label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{count} items</p>
      </div>
      <ChevronRight
        className="h-4 w-4 text-muted-foreground/50 group-hover:text-foreground group-hover:translate-x-0.5 transition-all self-end"
        aria-hidden
      />
    </button>
  )
}
