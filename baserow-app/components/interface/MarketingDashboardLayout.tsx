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
          "marketing-dashboard-shell flex flex-col min-h-0 min-w-0 w-full gap-8",
          "px-4 py-6 md:px-8 md:py-8"
        )}
        data-marketing-dashboard
      >
        {!bannerDismissed ? (
          <div className="flex items-center justify-between gap-3 rounded-card border border-border/50 bg-muted/30 px-3 py-2 text-sm text-muted-foreground shadow-card">
            <div className="flex items-center gap-2 min-w-0">
              <Search className="h-4 w-4 shrink-0 text-accent-link" aria-hidden />
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
                className="text-xs font-medium text-accent-link hover:underline ring-accent-focus rounded px-2 py-1"
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
            className="self-start text-xs text-muted-foreground hover:text-accent-link flex items-center gap-1.5"
          >
            <Search className="h-3.5 w-3.5" />
            <span>
              <kbd className="font-mono text-[10px]">⌘K</kbd> to search
            </span>
          </button>
        )}
        <div className="flex flex-col min-h-0 min-w-0 w-full gap-10">{children}</div>
      </div>
    </MarketingDashboardProvider>
  )
}
