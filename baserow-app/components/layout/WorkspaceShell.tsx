"use client"

import { useState, useEffect } from "react"
import AirtableSidebar from "./AirtableSidebar"
import Topbar from "./Topbar"
import EditModeBanner from "./EditModeBanner"
import EditModeGuard from "./EditModeGuard"
import { RecordPanelProvider, useRecordPanel } from "@/contexts/RecordPanelContext"
import { RecordModalProvider } from "@/contexts/RecordModalContext"
import { SelectionContextProvider } from "@/contexts/SelectionContext"
import { PageActionsProvider } from "@/contexts/PageActionsContext"
import { RightSettingsPanelDataProvider, useRightSettingsPanelData } from "@/contexts/RightSettingsPanelDataContext"
import RightSettingsPanel from "@/components/interface/RightSettingsPanel"
import RecordPanel from "@/components/records/RecordPanel"
import { MainScrollProvider } from "@/contexts/MainScrollContext"
import { useUIMode } from "@/contexts/UIModeContext"
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
  const { data } = useRightSettingsPanelData()
  const { state: recordPanelState } = useRecordPanel()
  const isEditMode = useUIMode().isEdit()

  // Right Settings Panel: only mount in Edit Mode. UIModeContext is single source of truth.
  const hasInterfacePageContext = data?.page != null && data?.blocks != null
  const isRecordPanelOpen = recordPanelState.isOpen && recordPanelState.recordId
  const isRecordPanelEditMode = recordPanelState.interfaceMode === "edit"
  const hasRecordContextBlock = data?.recordId != null && data?.recordTableId != null && !isRecordPanelOpen
  const hasPanelContext =
    hasInterfacePageContext ||
    (isRecordPanelOpen && isRecordPanelEditMode) ||
    hasRecordContextBlock
  const isPanelVisible = hasPanelContext && isEditMode

  return (
    <div className="flex flex-col h-screen bg-gray-50 overflow-x-hidden">
      {/* Edit mode banner - full app width at top, above sidebar and content */}
      <EditModeBanner />
      <EditModeGuard />
      <div className="flex flex-1 min-h-0 min-w-0 overflow-hidden">
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
      {/* MainArea: InterfaceContainer + RecordPanel (inline) + RightSettingsPanel (edit mode only) */}
      <div className="flex flex-1 min-w-0 overflow-hidden">
        {/* InterfaceContainer - flex-1 fills remaining space; w-full when panels unmounted */}
        <div className="flex flex-1 flex flex-col min-w-0 overflow-hidden w-full">
          {!hideTopbar && (
            <Topbar
              title={title}
              onSidebarToggle={isMobile ? () => setSidebarOpen(!sidebarOpen) : undefined}
              isAdmin={userRole === "admin"}
            />
          )}
          <main className="flex-1 min-h-0 min-w-0 overflow-hidden">
            {children}
          </main>
        </div>
        {/* RecordPanel - inline on right when open (desktop); overlay on mobile (portaled) */}
        {!hideRecordPanel && <RecordPanel />}
        {/* RightSettingsPanel: conditional mount, edit mode only, flex sibling */}
        {isPanelVisible && (
          <div className="flex-shrink-0 w-[360px]">
            <RightSettingsPanel />
          </div>
        )}
      </div>
      </div>
    </div>
  )
}
