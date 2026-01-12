"use client"

import { useState } from "react"
import AirtableSidebar from "./AirtableSidebar"
import Topbar from "./Topbar"
import { RecordPanelProvider } from "@/contexts/RecordPanelContext"
import RecordPanel from "@/components/records/RecordPanel"
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
  const [isCollapsed, setIsCollapsed] = useState(false)

  return (
    <RecordPanelProvider>
      <div className="flex h-screen bg-gray-50">
        <AirtableSidebar
          interfacePages={interfacePages}
          interfaceGroups={interfaceGroups}
          tables={tables}
          views={views}
          userRole={userRole}
        />
        <div className="flex-1 flex flex-col overflow-hidden">
          {!hideTopbar && <Topbar title={title} />}
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
