"use client"

import { useState, useEffect } from "react"
import AirtableSidebar from "./AirtableSidebar"
import Topbar from "./Topbar"
import { RecordPanelProvider } from "@/contexts/RecordPanelContext"
import { RecordModalProvider } from "@/contexts/RecordModalContext"
import { PageActionsProvider } from "@/contexts/PageActionsContext"
import RecordPanel from "@/components/records/RecordPanel"
import { MainScrollProvider, useMainScroll } from "@/contexts/MainScrollContext"
import { useIsMobile } from "@/hooks/useResponsive"
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
  const isMobile = useIsMobile()
  const { primaryColor } = useBranding()
  // On mobile: sidebar closed by default
  // On tablet/desktop: sidebar visible by default (handled internally)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  
  // Persist sidebar state per device type
  useEffect(() => {
    if (isMobile) {
      // Load from localStorage with device-specific key
      const saved = localStorage.getItem('sidebar-open-mobile')
      if (saved !== null) {
        setSidebarOpen(JSON.parse(saved))
      }
    }
  }, [isMobile])
  
  useEffect(() => {
    if (isMobile) {
      localStorage.setItem('sidebar-open-mobile', JSON.stringify(sidebarOpen))
    }
  }, [sidebarOpen, isMobile])

  return (
    <RecordPanelProvider>
      <RecordModalProvider>
      <PageActionsProvider>
      <MainScrollProvider>
        <WorkspaceShellContent
          hideTopbar={hideTopbar}
          isMobile={isMobile}
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          primaryColor={primaryColor}
          title={title}
          tables={tables}
          views={views}
          interfacePages={interfacePages}
          interfaceGroups={interfaceGroups}
          dashboards={dashboards}
          userRole={userRole}
          hideRecordPanel={hideRecordPanel}
        >
          {children}
        </WorkspaceShellContent>
      </MainScrollProvider>
      </PageActionsProvider>
      </RecordModalProvider>
    </RecordPanelProvider>
  )
}

function WorkspaceShellContent({
  children,
  title,
  tables,
  views,
  interfacePages,
  interfaceGroups = [],
  userRole,
  hideTopbar = false,
  hideRecordPanel = false,
  isMobile,
  sidebarOpen,
  setSidebarOpen,
  primaryColor,
}: WorkspaceShellProps & {
  isMobile: boolean
  sidebarOpen: boolean
  setSidebarOpen: (v: boolean) => void
  primaryColor: string
}) {
  const mainScroll = useMainScroll()
  const suppressMainScroll = mainScroll?.suppressMainScroll ?? false

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* When topbar is hidden (some pages have their own toolbar), still provide a mobile hamburger toggle */}
      {hideTopbar && isMobile && (
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
        isOpen={isMobile ? sidebarOpen : undefined}
        onClose={isMobile ? () => setSidebarOpen(false) : undefined}
      />
      {/* P2 FIX: Main content area + RecordPanel in flex row for inline canvas layout */}
      <div className="flex-1 flex flex-row overflow-hidden min-h-0 gap-0">
        {/* Main content - resizes when panel opens */}
        <div className="flex-1 flex flex-col overflow-hidden min-h-0 min-w-0">
          {!hideTopbar && (
            <Topbar
              title={title}
              onSidebarToggle={isMobile ? () => setSidebarOpen(!sidebarOpen) : undefined}
              isAdmin={userRole === "admin"}
            />
          )}
          <main
            className={`flex-1 min-h-0 ${suppressMainScroll ? "overflow-hidden" : "overflow-y-auto"}`}
          >
            {children}
          </main>
        </div>
        {/* P2 FIX: Record Panel as inline canvas - participates in flex layout */}
        {/* Global Record Panel - hidden for pages with their own record detail panel */}
        {!hideRecordPanel && <RecordPanel />}
      </div>
    </div>
  )
}
