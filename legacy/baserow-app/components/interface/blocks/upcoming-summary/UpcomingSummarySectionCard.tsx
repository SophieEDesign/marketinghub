"use client"

import type { ReactNode } from "react"
import { ChevronRight, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export interface UpcomingSummarySectionCardProps {
  icon: LucideIcon
  iconWrapClass: string
  iconClass: string
  title: string
  subtitle: string
  countLabel?: string
  countBadgeClass?: string
  showCounts?: boolean
  showViewAll?: boolean
  viewAllLabel?: string
  isEditing?: boolean
  isCompact?: boolean
  onViewAll?: () => void
  children: ReactNode
}

export default function UpcomingSummarySectionCard({
  icon: Icon,
  iconWrapClass,
  iconClass,
  title,
  subtitle,
  countLabel,
  countBadgeClass,
  showCounts = true,
  showViewAll = true,
  viewAllLabel,
  isEditing = false,
  isCompact = false,
  onViewAll,
  children,
}: UpcomingSummarySectionCardProps) {
  return (
    <article
      className={cn(
        "flex flex-col rounded-2xl border border-[#E6E6EF] bg-white shadow-sm",
        isCompact ? "p-3" : "p-4"
      )}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2.5">
          <div
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
              iconWrapClass
            )}
          >
            <Icon className={cn("h-4 w-4", iconClass)} aria-hidden />
          </div>
          <div className="min-w-0">
            <h3
              className={cn(
                "font-semibold leading-snug text-[#111827]",
                isCompact ? "text-xs" : "text-sm"
              )}
            >
              {title}
            </h3>
            <p className={cn("text-[#6B7280]", isCompact ? "text-[10px]" : "text-xs")}>
              {subtitle}
            </p>
          </div>
        </div>
        {showCounts && countLabel ? (
          <span
            className={cn(
              "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
              countBadgeClass
            )}
          >
            {countLabel}
          </span>
        ) : null}
      </div>

      <ul className="flex-1 space-y-0.5">{children}</ul>

      {showViewAll && viewAllLabel ? (
        <button
          type="button"
          disabled={isEditing}
          onClick={onViewAll}
          className={cn(
            "mt-3 flex w-full items-center gap-0.5 text-left text-xs font-medium text-blue-600 transition-colors hover:text-blue-700 disabled:opacity-60",
            isCompact && "mt-2"
          )}
        >
          {viewAllLabel}
          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        </button>
      ) : null}
    </article>
  )
}
