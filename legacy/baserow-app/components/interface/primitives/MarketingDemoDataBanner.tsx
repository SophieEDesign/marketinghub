"use client"

import { cn } from "@/lib/utils"

interface MarketingDemoDataBannerProps {
  message: string
  className?: string
}

/** Shown when a marketing block is using sample/demo data instead of live tables. */
export default function MarketingDemoDataBanner({
  message,
  className,
}: MarketingDemoDataBannerProps) {
  return (
    <p
      role="status"
      className={cn(
        "shrink-0 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900",
        className
      )}
    >
      {message}
    </p>
  )
}
