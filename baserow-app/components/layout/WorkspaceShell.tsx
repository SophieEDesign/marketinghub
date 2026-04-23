"use client"

import { useState, useEffect, useMemo } from "react"
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
import { useSelectionContext } from "@/contexts/SelectionContext"
import { useIsMobile } from "@/hooks/useResponsive"
import { useBranding } from "@/contexts/BrandingContext"
import { Button } from "@/components/ui/button"
import { Menu } from "lucide-react"
import OnboardingTour from "./OnboardingTour"
import type { Table, View } from "@/types/database"
import { SHELL_RIGHT_SETTINGS_WIDTH_PX } from "@/lib/interface/layout-constants"
import { AppShell } from "@/components/layout/ui-system"

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
  landingPageTitle?: string | null
  /** Section title for the tables area in sidebar. Default: "Data & tables" */
  coreDataSectionTitle?: string
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
  landingPageTitle = null,
  coreDataSectionTitle,
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
          landingPageTitle={landingPageTitle}
          coreDataSectionTitle={coreDataSectionTitle}
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
  landingPageTitle = null,
  coreDataSectionTitle,
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
  const isEditMode = useUIMode().isEdit()
  const { selectedContext } = useSelectionContext()
  const [sidebarAutoCompactDismissed, setSidebarAutoCompactDismissed] = useState(false)

  // Right Settings Panel: always visible in Edit Mode - cannot be closed/crossed off.
  // UIModeContext is single source of truth. Panel shows "Select an element" when no context.
  const isPanelVisible = isEditMode
  const hasBlockLevelSelection = useMemo(
    () =>
      selectedContext?.type === "block" ||
      selectedContext?.type === "recordList" ||
      selectedContext?.type === "field" ||
      selectedContext?.type === "record",
    [selectedContext?.type]
  )
  const shouldAutoCompactSidebar =
    !isMobile && isEditMode && isPanelVisible && hasBlockLevelSelection && !sidebarAutoCompactDismissed

  // Reset manual override when edit-panel state no longer requires compact mode.
  useEffect(() => {
    if (!isEditMode || !isPanelVisible || !hasBlockLevelSelection) {
      setSidebarAutoCompactDismissed(false)
    }
  }, [isEditMode, isPanelVisible, hasBlockLevelSelection])

  return (
    <div className="flex flex-col h-screen min-h-[100dvh] bg-background overflow-hidden">
      {!hideTopbar && <OnboardingTour />}
      {/* Edit mode banner - full app width at top, above sidebar and content */}
      <EditModeBanner />
      <EditModeGuard />
      <AppShell
        sidebar={
          <AirtableSidebar
            interfacePages={interfacePages}
            interfaceGroups={interfaceGroups}
            tables={tables}
            views={views}
            userRole={userRole}
            isOpen={isMobile ? sidebarOpen : undefined}
            onClose={isMobile ? () => setSidebarOpen(false) : undefined}
            defaultPageId={defaultPageId}
            landingPageTitle={landingPageTitle}
            coreDataSectionTitle={coreDataSectionTitle}
            autoCompact={shouldAutoCompactSidebar}
            onAutoCompactDismiss={() => setSidebarAutoCompactDismissed(true)}
          />
        }
        canvas={
          <>
            {/* When topbar is hidden (some pages have their own toolbar), still provide a mobile hamburger toggle */}
            {hideTopbar && isMobile && (
              <div className="fixed top-3 left-3 z-50 desktop:hidden">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-10 w-10 p-0 bg-background/90 border border-border shadow"
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  aria-label="Toggle sidebar"
                >
                  <Menu className="h-5 w-5" style={{ color: primaryColor }} />
                </Button>
              </div>
            )}
            <div className="flex flex-1 min-h-0 min-w-0 w-full">
              {/* InterfaceContainer: min-h-0 allows height to flow to main > CalendarView */}
              <div className="flex flex-1 basis-0 flex-col min-h-0 min-w-0 overflow-hidden">
                {!hideTopbar && (
                  <Topbar
                    title={title}
                    onSidebarToggle={isMobile ? () => setSidebarOpen(!sidebarOpen) : undefined}
                    isAdmin={userRole === "admin"}
                  />
                )}
                <main className="flex flex-col flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden">
                  {children}
                </main>
              </div>
              {/* RecordPanel - inline on right when open (desktop); overlay on mobile (portaled) */}
              {!hideRecordPanel && <RecordPanel />}
            </div>
          </>
        }
        rightPanel={
          isPanelVisible ? (
            <div
              className="flex flex-col min-h-0 shrink-0 grow-0 overflow-hidden"
              style={{
                width: `${SHELL_RIGHT_SETTINGS_WIDTH_PX}px`,
                minWidth: `${SHELL_RIGHT_SETTINGS_WIDTH_PX}px`,
                maxWidth: `${SHELL_RIGHT_SETTINGS_WIDTH_PX}px`,
              }}
            >
              <RightSettingsPanel />
            </div>
          ) : null
        }
      />
    </div>
  )
}
