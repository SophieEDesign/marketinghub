"use client"

import type { ReactNode } from "react"
import { MarketingDashboardProvider } from "@/contexts/MarketingDashboardContext"
import { cn } from "@/lib/utils"

interface MarketingDashboardLayoutProps {
  children: ReactNode
  /** Sole full-page block: fill viewport, no dashboard shell padding. */
  fullPage?: boolean
}

/**
 * Wraps the interface canvas for Marketing Hub workspace pages: calmer spacing
 * and provider for child blocks (card styling, status pills).
 */
/** When enabled, wraps canvas with marketing shell + context; otherwise renders children only. */
export function MarketingDashboardCanvasShell({
  enabled,
  fullPage = false,
  children,
}: {
  enabled: boolean
  fullPage?: boolean
  children: ReactNode
}) {
  if (!enabled) return <>{children}</>
  return <MarketingDashboardLayout fullPage={fullPage}>{children}</MarketingDashboardLayout>
}

export default function MarketingDashboardLayout({
  children,
  fullPage = false,
}: MarketingDashboardLayoutProps) {
  return (
    <MarketingDashboardProvider>
      <div
        className={cn(
          "marketing-dashboard-shell flex flex-col min-w-0 w-full",
          fullPage
            ? "flex-1 min-h-0 h-full px-0 py-0"
            : "min-h-0 px-2.5 py-2 sm:px-3 md:px-4 md:py-3 lg:px-5"
        )}
        data-marketing-dashboard
        data-marketing-full-page={fullPage ? "true" : undefined}
      >
        <div
          className={cn(
            "mx-auto flex w-full max-w-none min-w-0 flex-col",
            fullPage && "flex-1 min-h-0 h-full"
          )}
        >
          {children}
        </div>
      </div>
    </MarketingDashboardProvider>
  )
}
