"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ChevronDown, Table2, Settings, Shield, Home } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useBranding } from "@/contexts/BrandingContext"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface BaseDropdownProps {
  /** Optional: compact styling for page header (e.g. no border, smaller text) */
  variant?: "default" | "compact" | "sidebar"
  /** Optional: show as leftmost in a row with other header content */
  className?: string
  /** Optional: override trigger button style (e.g. for sidebar text color) */
  triggerStyle?: React.CSSProperties
  /** Optional: when provided, add Page settings to dropdown */
  onOpenPageSettings?: () => void
}

export default function BaseDropdown({
  variant = "default",
  className,
  triggerStyle,
  onOpenPageSettings,
}: BaseDropdownProps) {
  const { primaryColor, sidebarTextColor } = useBranding()
  const [baseName, setBaseName] = useState<string>("Base")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from("workspaces")
          .select("name, icon")
          .limit(1)
          .maybeSingle()
        if (!error && data?.name) {
          setBaseName(data.name)
        }
      } catch (e) {
        console.warn("BaseDropdown: could not load workspace name", e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const isCompact = variant === "compact" || variant === "sidebar"
  const isSidebar = variant === "sidebar"
  const triggerColor = triggerStyle?.color ?? (isSidebar ? sidebarTextColor : isCompact ? primaryColor : undefined)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className={cn(
            "flex items-center gap-1.5 font-semibold",
            isCompact ? "h-8 px-2 text-sm" : "h-9 px-3",
            className
          )}
          style={{ ...(triggerColor ? { color: triggerColor } : {}), ...triggerStyle }}
        >
          {loading ? "..." : baseName}
          <ChevronDown className="h-4 w-4 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {onOpenPageSettings && (
          <>
            <DropdownMenuItem onClick={onOpenPageSettings} className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Page settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem asChild>
          <Link href="/" className="flex items-center gap-2 cursor-pointer">
            <Home className="h-4 w-4" />
            Back to home
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/tables" className="flex items-center gap-2 cursor-pointer">
            <Table2 className="h-4 w-4" />
            Tables
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings" className="flex items-center gap-2 cursor-pointer">
            <Shield className="h-4 w-4" />
            Permissions
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
