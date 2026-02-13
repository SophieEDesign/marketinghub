"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ChevronDown, Table2, Settings, Shield, Copy, Trash2, Edit2, Eye, Home } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useBranding } from "@/contexts/BrandingContext"
import { useUIMode } from "@/contexts/UIModeContext"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import { cn } from "@/lib/utils"

interface BaseDropdownProps {
  /** Optional: compact styling for page header (e.g. no border, smaller text) */
  variant?: "default" | "compact"
  /** Optional: show as leftmost in a row with other header content */
  className?: string
  /** Optional: admin flag for Delete Base visibility */
  isAdmin?: boolean
  /** Optional: when provided, show Edit/View toggle (Airtable-style) at top of dropdown */
  onEnterEdit?: () => void
  /** Optional: when provided with onEnterEdit, show View option to exit edit mode */
  onExitEdit?: () => void
  /** Optional: true when in edit mode (for highlighting active state) */
  isEditMode?: boolean
  /** Optional: when provided, add Page settings to dropdown */
  onOpenPageSettings?: () => void
}

export default function BaseDropdown({
  variant = "default",
  className,
  isAdmin = false,
  onEnterEdit,
  onExitEdit,
  isEditMode: isEditModeProp,
  onOpenPageSettings,
}: BaseDropdownProps) {
  const { primaryColor } = useBranding()
  const { toast } = useToast()
  const { uiMode } = useUIMode()
  const showEditViewToggle = onEnterEdit != null && onExitEdit != null
  const inAnyEditMode = isEditModeProp ?? uiMode !== "view"
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

  const handleDuplicateBase = () => {
    toast({
      title: "Duplicate Base",
      description: "This action is not yet implemented.",
    })
  }

  const handleDeleteBase = () => {
    toast({
      title: "Delete Base",
      description: "This action is not yet implemented.",
      variant: "destructive",
    })
  }

  const isCompact = variant === "compact"

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
          style={isCompact ? { color: primaryColor } : undefined}
        >
          {loading ? "..." : baseName}
          <ChevronDown className="h-4 w-4 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {/* Airtable-style: Edit or View (no View data) */}
        {showEditViewToggle && (
          <>
            {inAnyEditMode ? (
              <DropdownMenuItem onClick={onExitEdit} className="flex items-center gap-2">
                <Eye className="h-4 w-4" />
                View
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={onEnterEdit} className="flex items-center gap-2">
                <Edit2 className="h-4 w-4" />
                Edit
              </DropdownMenuItem>
            )}
            <DropdownMenuItem asChild>
              <Link href="/" className="flex items-center gap-2 cursor-pointer">
                <Home className="h-4 w-4" />
                Back to home
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
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
          <Link href="/tables" className="flex items-center gap-2 cursor-pointer">
            <Table2 className="h-4 w-4" />
            Tables
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings" className="flex items-center gap-2 cursor-pointer">
            <Settings className="h-4 w-4" />
            Base Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings" className="flex items-center gap-2 cursor-pointer">
            <Shield className="h-4 w-4" />
            Permissions
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleDuplicateBase} className="flex items-center gap-2">
          <Copy className="h-4 w-4" />
          Duplicate Base
        </DropdownMenuItem>
        {isAdmin && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleDeleteBase}
              className="flex items-center gap-2 text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
              Delete Base
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
