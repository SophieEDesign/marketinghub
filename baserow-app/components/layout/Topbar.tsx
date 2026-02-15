"use client"

import { Search, User, Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useBranding } from "@/contexts/BrandingContext"

interface TopbarProps {
  title?: string
  onSidebarToggle?: () => void
  /** Pass when known (e.g. from server) so Delete Base can be shown for admins */
  isAdmin?: boolean
}

export default function Topbar({ title, onSidebarToggle, isAdmin }: TopbarProps) {
  const { primaryColor } = useBranding()

  return (
    <div className="h-14 border-b bg-white flex items-center justify-between px-6">
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
          <span className="text-lg font-semibold text-gray-700 truncate hidden sm:inline">
            {title}
          </span>
        )}
      </div>
      
      <div className="flex items-center gap-3">
        {/* Search placeholder */}
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4" style={{ color: primaryColor }} />
          <Input
            type="search"
            placeholder="Search..."
            className="pl-9 w-64 h-9 bg-gray-50 border-gray-200"
            disabled
          />
        </div>
        
        {/* User avatar dropdown placeholder */}
        <Button
          variant="ghost"
          size="sm"
          className="h-9 w-9 rounded-full p-0"
        >
          <User className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
