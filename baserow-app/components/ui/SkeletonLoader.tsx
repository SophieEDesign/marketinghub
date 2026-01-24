"use client"

import { cn } from "@/lib/utils"

interface SkeletonLoaderProps {
  className?: string
  count?: number
  height?: string
}

/**
 * Skeleton loader component for initial page loads
 */
export function SkeletonLoader({
  className,
  count = 1,
  height = "h-4",
}: SkeletonLoaderProps) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "animate-pulse rounded-md bg-muted",
            height,
            className
          )}
        />
      ))}
    </>
  )
}
