"use client"

import { useEffect, useState } from "react"
import { Search, User, Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useBranding } from "@/contexts/BrandingContext"
import { createClient } from "@/lib/supabase/client"

interface TopbarProps {
  title?: string
  onSidebarToggle?: () => void
}

export default function Topbar({ title, onSidebarToggle }: TopbarProps) {
  const { primaryColor } = useBranding()
  const [workspaceName, setWorkspaceName] = useState<string>("Marketing Hub")
  const [workspaceIcon, setWorkspaceIcon] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadWorkspace() {
      try {
        const supabase = createClient()
        
        // Fetch workspace name and icon from workspaces table
        const { data, error } = await supabase
          .from('workspaces')
          .select('name, icon')
          .limit(1)
          .maybeSingle()

        if (!error && data) {
          if (data.name) {
            setWorkspaceName(data.name)
          }
          if (data.icon) {
            setWorkspaceIcon(data.icon)
          }
        }
      } catch (error) {
        console.warn('Could not load workspace name and icon:', error)
      } finally {
        setLoading(false)
      }
    }

    loadWorkspace()
  }, [])

  // Use provided title if available, otherwise use workspace name
  const displayTitle = title || workspaceName

  return (
    <div className="h-14 border-b bg-white flex items-center justify-between px-6">
      <div className="flex items-center gap-4 flex-1">
        {/* Sidebar toggle button - only visible on mobile/tablet */}
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
        {workspaceIcon && (
          <span className="text-xl" role="img" aria-label="Workspace icon">
            {workspaceIcon}
          </span>
        )}
        <h1 className="text-lg font-semibold" style={{ color: primaryColor }}>
          {loading ? "Loading..." : displayTitle}
        </h1>
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
