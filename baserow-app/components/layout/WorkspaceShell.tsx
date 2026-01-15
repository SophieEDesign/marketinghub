"use client"

import { useState, useEffect } from "react"
import AirtableSidebar from "./AirtableSidebar"
import Topbar from "./Topbar"
import { RecordPanelProvider } from "@/contexts/RecordPanelContext"
import RecordPanel from "@/components/records/RecordPanel"
import { useIsMobileOrTablet } from "@/hooks/useResponsive"
import { useBranding } from "@/contexts/BrandingContext"
import { Button } from "@/components/ui/button"
import { Menu } from "lucide-react"
import type { Table, View } from "@/types/database"

interface InterfacePage {
  id: string
  name: string
  description?: string
  config?: Record<string, any>
  access_level: string
  allowed_roles?: string[]
  owner_id?: string
  created_at: string
  updated_at: string
}

interface Dashboard {
  id: string
  name: string
  description?: string
  config?: Record<string, any>
  access_level: string
  allowed_roles?: string[]
  owner_id?: string
  created_at: string
  updated_at: string
}

interface InterfaceGroup {
  id: string
  name: string
  order_index: number
  collapsed: boolean
  workspace_id?: string | null
}

interface WorkspaceShellProps {
  children: React.ReactNode
  title?: string
  tables: Table[]
  views: Record<string, View[]>
  interfacePages: InterfacePage[]
  interfaceGroups?: InterfaceGroup[]
  dashboards: Dashboard[]
  userRole: "admin" | "member" | null
  hideTopbar?: boolean // Option to hide topbar (for interface pages that have their own toolbar)
  hideRecordPanel?: boolean // Option to hide the global RecordPanel (for pages that have their own record detail panel)
}

export default function WorkspaceShell({
  children,
  title,
  tables,
  views,
  interfacePages,
  interfaceGroups = [],
  dashboards,
  userRole,
  hideTopbar = false,
  hideRecordPanel = false,
}: WorkspaceShellProps) {
  const isMobileOrTablet = useIsMobileOrTablet()
  const { primaryColor } = useBranding()
  // On mobile/tablet: sidebar closed by default
  // On desktop: sidebar open by default (no state needed, handled internally)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  
  // Persist sidebar state per device type
  useEffect(() => {
    if (isMobileOrTablet) {
      // Load from localStorage with device-specific key
      const saved = localStorage.getItem('sidebar-open-mobile')
      if (saved !== null) {
        setSidebarOpen(JSON.parse(saved))
      }
    }
  }, [isMobileOrTablet])
  
  useEffect(() => {
    if (isMobileOrTablet) {
      localStorage.setItem('sidebar-open-mobile', JSON.stringify(sidebarOpen))
    }
  }, [sidebarOpen, isMobileOrTablet])

  return (
    <RecordPanelProvider>
      <div className="flex h-screen bg-gray-50">
        {/* When topbar is hidden (some pages have their own toolbar), still provide a mobile hamburger toggle */}
        {hideTopbar && isMobileOrTablet && (
          <div className="fixed top-3 left-3 z-50 desktop:hidden">
            <Button
              variant="ghost"
              size="sm"
              className="h-10 w-10 p-0 bg-white/90 border border-gray-200 shadow"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              aria-label="Toggle sidebar"
            >
              <Menu className="h-5 w-5" style={{ color: primaryColor }} />
            </Button>
          </div>
        )}

        <AirtableSidebar
          interfacePages={interfacePages}
          interfaceGroups={interfaceGroups}
          tables={tables}
          views={views}
          userRole={userRole}
          isOpen={isMobileOrTablet ? sidebarOpen : undefined}
          onClose={isMobileOrTablet ? () => setSidebarOpen(false) : undefined}
        />
        <div className="flex-1 flex flex-col overflow-hidden">
          {!hideTopbar && (
            <Topbar 
              title={title} 
              onSidebarToggle={isMobileOrTablet ? () => setSidebarOpen(!sidebarOpen) : undefined}
            />
          )}
          <main className="flex-1 overflow-y-auto">
            {children}
          </main>
        </div>
        {/* Global Record Panel - hidden for pages with their own record detail panel */}
        {!hideRecordPanel && <RecordPanel />}
      </div>
    </RecordPanelProvider>
  )
}
