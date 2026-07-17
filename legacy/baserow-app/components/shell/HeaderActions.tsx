"use client"

import { Search } from "lucide-react"
import { useCommandPalette } from "@/contexts/CommandPaletteContext"
import UserMenu from "@/components/layout/UserMenu"
import { cn } from "@/lib/utils"

// TODO: wire notifications to real activity/notification table later.

interface HeaderActionsProps {
  className?: string
  showSearch?: boolean
}

export default function HeaderActions({ className, showSearch = true }: HeaderActionsProps) {
  const commandPalette = useCommandPalette()

  return (
    <div className={cn("flex items-center gap-1 sm:gap-2", className)}>
      {showSearch && (
        <button
          type="button"
          data-tour="search"
          onClick={() => commandPalette?.openPalette()}
          className="hidden md:flex items-center gap-2 h-9 min-w-[200px] lg:min-w-[280px] xl:min-w-[360px] pl-3 pr-3 rounded-full border border-hub-border bg-muted/30 hover:bg-muted/50 text-muted-foreground text-sm cursor-pointer transition-colors"
        >
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate text-left flex-1">Search campaigns, content, events…</span>
          <kbd className="hidden lg:inline-flex h-5 select-none items-center gap-0.5 rounded-md border border-hub-border bg-background px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            ⌘K
          </kbd>
        </button>
      )}

      <div data-tour="user-menu" className="ml-1">
        <UserMenu />
      </div>
    </div>
  )
}
