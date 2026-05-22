"use client"

import * as React from "react"
import { Menu, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useCommandPalette } from "@/contexts/CommandPaletteContext"
import HeaderActions from "./HeaderActions"
import { cn } from "@/lib/utils"

interface AppHeaderProps {
  title?: React.ReactNode
  leftSlot?: React.ReactNode
  onSidebarToggle?: () => void
  showSearch?: boolean
  className?: string
}

export default function AppHeader({
  title,
  leftSlot,
  onSidebarToggle,
  showSearch = true,
  className,
}: AppHeaderProps) {
  const commandPalette = useCommandPalette()

  return (
    <header
      className={cn(
        "flex-shrink-0 flex h-14 items-center gap-3 border-b border-hub-border bg-white/90 backdrop-blur-sm px-4 md:px-6",
        className
      )}
    >
      {onSidebarToggle && (
        <Button
          variant="ghost"
          size="sm"
          className="h-9 w-9 p-0 desktop:hidden shrink-0"
          onClick={onSidebarToggle}
          aria-label="Toggle sidebar"
        >
          <Menu className="h-5 w-5 text-foreground" />
        </Button>
      )}

      {leftSlot ?? (title ? (
        <div className="min-w-0 shrink-0 max-w-[200px] sm:max-w-xs">
          {typeof title === "string" ? (
            <span className="truncate block text-base font-semibold text-foreground">{title}</span>
          ) : (
            title
          )}
        </div>
      ) : null)}

      {showSearch && (
        <button
          type="button"
          data-tour="search"
          onClick={() => commandPalette?.openPalette()}
          className="hidden md:flex flex-1 max-w-md mx-auto items-center gap-2 h-9 px-4 rounded-full border border-hub-border bg-muted/30 hover:bg-muted/50 text-muted-foreground text-sm cursor-pointer transition-colors"
        >
          <Search className="h-4 w-4 shrink-0" />
          <span className="truncate flex-1 text-left">Search campaigns, content, events…</span>
          <kbd className="hidden lg:inline-flex h-5 select-none items-center rounded-md border border-hub-border bg-background px-1.5 font-mono text-[10px] font-medium">
            ⌘K
          </kbd>
        </button>
      )}

      <HeaderActions showSearch={false} className="shrink-0 ml-auto" />
    </header>
  )
}
