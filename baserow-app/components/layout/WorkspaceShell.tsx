"use client"

import { useState, useEffect } from "react"
import AirtableSidebar from "./AirtableSidebar"
import Topbar from "./Topbar"
import { RecordPanelProvider } from "@/contexts/RecordPanelContext"
import { RecordModalProvider } from "@/contexts/RecordModalContext"
import { SelectionContextProvider } from "@/contexts/SelectionContext"
import { PageActionsProvider } from "@/contexts/PageActionsContext"
import { RightSettingsPanelDataProvider } from "@/contexts/RightSettingsPanelDataContext"
import RightSettingsPanel from "@/components/interface/RightSettingsPanel"
import RecordPanel from "@/components/records/RecordPanel"
import { MainScrollProvider, useMainScroll } from "@/contexts/MainScrollContext"
import { useIsMobile } from "@/hooks/useResponsive"
import { useBranding } from "@/contexts/BrandingContext"
import { Button } from "@/components/ui/button"
import { Menu } from "lucide-react"
import WelcomeScreen from "@/components/onboarding/WelcomeScreen"
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
  _id?: string | null
}

interface ShellProps {
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
  defaultPageId?: string | null // For "Back to home" link - never link to abstract /
}

export default function Shell({
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
  defaultPageId = null,
}: ShellProps) {
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
    <SelectionContextProvider>
      <RightSettingsPanelDataProvider>
      <RecordPanelProvider>
      <RecordModalProvider>
      <PageActionsProvider>
      <MainScrollProvider>
        <ShellContent
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
          defaultPageId={defaultPageId}
        >
          {children}
        </ShellContent>
      </MainScrollProvider>
      </PageActionsProvider>
      <RightSettingsPanel />
      <WelcomeScreen />
      </RecordModalProvider>
      </RecordPanelProvider>
      </RightSettingsPanelDataProvider>
    </SelectionContextProvider>
  )
}

function ShellContent({
  children,
  title,
  tables,
  views,
  interfacePages,
  interfaceGroups = [],
  userRole,
  hideTopbar = false,
  hideRecordPanel = false,
  defaultPageId = null,
  isMobile,
  sidebarOpen,
  setSidebarOpen,
  primaryColor,
}: ShellProps & {
  isMobile: boolean
  sidebarOpen: boolean
  setSidebarOpen: (v: boolean) => void
  primaryColor: string
}) {
  const mainScroll = useMainScroll()
  const suppressMainScroll = mainScroll?.suppressMainScroll ?? false

  return (
    <div className="flex h-screen bg-gray-50 overflow-x-hidden">
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
        defaultPageId={defaultPageId}
      />
      {/* Main content area - RecordPanel overlays when open (position: fixed) */}
      <div className="flex-1 flex flex-col overflow-x-hidden min-h-0 min-w-0">
        {!hideTopbar && (
          <Topbar
            title={title}
            onSidebarToggle={isMobile ? () => setSidebarOpen(!sidebarOpen) : undefined}
            isAdmin={userRole === "admin"}
          />
        )}
        <main
          className={`flex-1 min-h-0 overflow-x-hidden ${suppressMainScroll ? "overflow-y-hidden" : "overflow-y-auto"}`}
        >
          {children}
        </main>
      </div>
      {/* Record Panel - overlay only, hidden for pages with their own record detail panel */}
      {!hideRecordPanel && <RecordPanel />}
    </div>
  )
}
