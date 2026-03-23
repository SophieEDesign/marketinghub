"use client"

import { Search, Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useBranding } from "@/contexts/BrandingContext"
import ThemeToggle from "./ThemeToggle"
import UserMenu from "./UserMenu"
import { useCommandPalette } from "@/contexts/CommandPaletteContext"

interface TopbarProps {
  title?: string
  onSidebarToggle?: () => void
  /** Pass when known (e.g. from server) so Delete Base can be shown for admins */
  isAdmin?: boolean
}

export default function Topbar({ title, onSidebarToggle, isAdmin }: TopbarProps) {
  const { primaryColor } = useBranding()
  const commandPalette = useCommandPalette()

  return (
    <div className="h-14 border-b border-border bg-background flex items-center justify-between px-6">
      <div className="flex items-center gap-4 flex-1">
        {onSidebarToggle && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 w-9 p-0 desktop:hidden"
            onClick={onSidebarToggle}
            aria-label="Toggle sidebar"
          >
            <Menu className="h-5 w-5" style={{ color: primaryColor }} />
          </Button>
        )}
        {title && (
          <span className="text-lg font-semibold text-foreground truncate">
            {title}
          </span>
        )}
      </div>
      
      <div className="flex items-center gap-3">
        <ThemeToggle />
        {/* Search - opens command palette */}
        <button
          type="button"
          data-tour="search"
          onClick={() => commandPalette?.openPalette()}
          className="hidden md:flex items-center gap-2 pl-3 pr-4 py-2 w-64 h-9 rounded-md border border-input bg-muted/50 hover:bg-muted text-muted-foreground text-sm cursor-pointer transition-colors"
        >
          <Search className="h-4 w-4 shrink-0" style={{ color: primaryColor }} />
          <span>Search...</span>
          <kbd className="ml-auto hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium">
            ⌘K
          </kbd>
        </button>
        
        <div data-tour="user-menu">
          <UserMenu />
        </div>
      </div>
    </div>
  )
}
