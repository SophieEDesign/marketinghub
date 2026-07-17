"use client"

import { cn } from "@/lib/utils"

interface GridSkeletonProps {
  columns?: number
  rows?: number
  className?: string
}

/**
 * Skeleton loader that mimics a grid/table layout.
 * Use for grid and table loading states.
 */
export function GridSkeleton({ columns = 5, rows = 8, className }: GridSkeletonProps) {
  return (
    <div className={cn("w-full overflow-hidden", className)}>
      {/* Header row */}
      <div className="flex border-b border-border bg-muted/30">
        {Array.from({ length: columns }).map((_, i) => (
          <div
            key={`h-${i}`}
            className="flex-1 min-w-[100px] px-3 py-2"
          >
            <div className="h-4 w-3/4 max-w-[120px] animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
      {/* Data rows */}
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div
          key={`r-${rowIdx}`}
          className="flex border-b border-border/50"
        >
          {Array.from({ length: columns }).map((_, colIdx) => (
            <div
              key={`r-${rowIdx}-c-${colIdx}`}
              className="flex-1 min-w-[100px] px-3 py-2"
            >
              <div
                className="h-4 animate-pulse rounded bg-muted"
                style={{ width: `${60 + (colIdx + rowIdx) % 40}%` }}
              />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
