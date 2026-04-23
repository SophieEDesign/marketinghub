"use client"

import { useState, useEffect, type ReactNode } from "react"
import { X, Search } from "lucide-react"
import { MarketingDashboardProvider } from "@/contexts/MarketingDashboardContext"
import { useCommandPalette } from "@/contexts/CommandPaletteContext"
import { cn } from "@/lib/utils"

const STORAGE_KEY = "marketing-dashboard-search-hint-dismissed"

interface MarketingDashboardLayoutProps {
  children: ReactNode
}

/**
 * Wraps the interface canvas for the Marketing Dashboard page: calmer spacing,
 * search hint, and provider for child blocks (card styling, status pills).
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
  const commandPalette = useCommandPalette()
  const [bannerDismissed, setBannerDismissed] = useState(false)

  useEffect(() => {
    try {
      setBannerDismissed(localStorage.getItem(STORAGE_KEY) === "1")
    } catch {
      setBannerDismissed(false)
    }
  }, [])

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "1")
    } catch {
      /* ignore */
    }
    setBannerDismissed(true)
  }

  return (
    <MarketingDashboardProvider>
      <div
        className={cn(
          "marketing-dashboard-shell flex flex-col min-h-0 min-w-0 w-full",
          "px-2.5 py-3.5 sm:px-3 md:px-4 md:py-5 lg:px-5 lg:py-5.5"
        )}
        data-marketing-dashboard
      >
        <div className="mx-auto flex w-full max-w-none min-h-0 min-w-0 flex-col gap-4 md:gap-5 lg:gap-6">
        {!bannerDismissed ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-border/45 bg-background/90 px-3.5 py-2.5 text-sm text-muted-foreground shadow-card sm:flex-nowrap">
            <div className="flex items-center gap-2 min-w-0">
              <div className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted/70 text-accent-link">
                <Search className="h-3.5 w-3.5" aria-hidden />
              </div>
              <span>
                Press{" "}
                <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border border-border bg-background px-1.5 font-mono text-[10px] font-medium text-foreground">
                  ⌘K
                </kbd>{" "}
                (or{" "}
                <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border border-border bg-background px-1.5 font-mono text-[10px] font-medium text-foreground">
                  Ctrl+K
                </kbd>
                ) to search
              </span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => commandPalette?.openPalette()}
                className="text-xs font-medium text-accent-link/90 hover:text-accent-link hover:underline ring-accent-focus rounded px-2 py-1"
              >
                Open search
              </button>
              <button
                type="button"
                onClick={dismiss}
                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Dismiss hint"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => commandPalette?.openPalette()}
            className="self-start text-xs text-muted-foreground/90 hover:text-accent-link flex items-center gap-1.5 rounded-md px-1.5 py-1 transition-colors"
          >
            <Search className="h-3.5 w-3.5" />
            <span>
              <kbd className="font-mono text-[10px]">⌘K</kbd> to search
            </span>
          </button>
        )}
        <div className="flex w-full min-h-0 min-w-0 max-w-full flex-col gap-4 md:gap-5 lg:gap-6">{children}</div>
        </div>
      </div>
    </MarketingDashboardProvider>
  )
}
