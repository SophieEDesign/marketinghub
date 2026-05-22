"use client"

import type { ReactNode } from "react"
import { MarketingDashboardProvider } from "@/contexts/MarketingDashboardContext"
import { cn } from "@/lib/utils"

interface MarketingDashboardLayoutProps {
  children: ReactNode
}

/**
 * Wraps the interface canvas for Marketing Hub workspace pages: calmer spacing
 * and provider for child blocks (card styling, status pills).
 */
/** When enabled, wraps canvas with marketing shell + context; otherwise renders children only. */
export function MarketingDashboardCanvasShell({
  enabled,
  children,
}: {
  enabled: boolean
  children: ReactNode
}) {
  if (!enabled) return <>{children}</>
  return <MarketingDashboardLayout>{children}</MarketingDashboardLayout>
}

export default function MarketingDashboardLayout({ children }: MarketingDashboardLayoutProps) {
  return (
    <MarketingDashboardProvider>
      <div
        className={cn(
          "marketing-dashboard-shell flex flex-col min-h-0 min-w-0 w-full",
          "px-2.5 py-2 sm:px-3 md:px-4 md:py-3 lg:px-5"
        )}
        data-marketing-dashboard
      >
        <div className="mx-auto flex w-full max-w-none min-h-0 min-w-0 flex-col">
          {children}
        </div>
      </div>
    </MarketingDashboardProvider>
  )
}
