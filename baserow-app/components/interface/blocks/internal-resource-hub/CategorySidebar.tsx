"use client"

import { ChevronRight, ShieldCheck } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  HUB_CATEGORY_OPTIONS,
  getFileTypeBadgeClasses,
  type CategoryFilter,
  type MockResource,
} from "./types"

interface CategorySidebarProps {
  category: CategoryFilter
  counts: Record<CategoryFilter, number>
  recent: MockResource[]
  noticeText: string
  showRecent: boolean
  onCategoryChange: (c: CategoryFilter) => void
  onSelectResource: (id: string) => void
  className?: string
}

export default function CategorySidebar({
  category,
  counts,
  recent,
  noticeText,
  showRecent,
  onCategoryChange,
  onSelectResource,
  className,
}: CategorySidebarProps) {
  return (
    <aside
      className={cn(
        "flex w-60 shrink-0 flex-col border-r border-border/60 bg-muted/10",
        className
      )}
    >
      <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
        {HUB_CATEGORY_OPTIONS.map((opt) => {
          const Icon = opt.icon
          const active = category === opt.id
          const count = counts[opt.id] ?? 0
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onCategoryChange(opt.id)}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm transition-colors",
                active
                  ? "bg-blue-50 font-medium text-blue-700"
                  : "text-foreground/80 hover:bg-muted/60"
              )}
            >
              <Icon className={cn("h-4 w-4 shrink-0", active ? "text-blue-600" : "text-muted-foreground")} />
              <span className="flex-1 truncate">{opt.label}</span>
              <span
                className={cn(
                  "text-xs tabular-nums",
                  active ? "text-blue-600/80" : "text-muted-foreground"
                )}
              >
                {count}
              </span>
            </button>
          )
        })}
      </nav>

      {showRecent && recent.length > 0 && (
        <div className="border-t border-border/60 px-3 py-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Recently added
            </span>
            <button
              type="button"
              className="text-xs text-blue-600 hover:underline"
              onClick={() => onCategoryChange("all")}
            >
              View all
            </button>
          </div>
          <ul className="space-y-2">
            {recent.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => onSelectResource(r.id)}
                  className="w-full text-left group"
                >
                  <p className="truncate text-xs font-medium text-foreground group-hover:text-blue-700">
                    {r.title}
                  </p>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <span
                      className={cn(
                        "rounded px-1 py-0 text-[9px] font-semibold uppercase",
                        getFileTypeBadgeClasses(r.fileType)
                      )}
                    >
                      {r.fileType}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{r.addedAt}</span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="p-3">
        <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-3">
          <div className="flex items-start gap-2">
            <ShieldCheck className="h-4 w-4 shrink-0 text-blue-600 mt-0.5" />
            <p className="flex-1 text-xs leading-relaxed text-blue-900/80">{noticeText}</p>
            <ChevronRight className="h-4 w-4 shrink-0 text-blue-400" aria-hidden />
          </div>
        </div>
      </div>
    </aside>
  )
}
