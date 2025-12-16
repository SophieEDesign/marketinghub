"use client"

import { useState } from "react"
import Sidebar from "./Sidebar"
import Topbar from "./Topbar"
import type { Table, View, Automation } from "@/types/database"

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

interface WorkspaceShellProps {
  children: React.ReactNode
  title?: string
  tables: Table[]
  views: Record<string, View[]>
  interfacePages: InterfacePage[]
  dashboards: Dashboard[]
  automations: Automation[]
  userRole: "admin" | "editor" | "viewer" | null
}

export default function WorkspaceShell({
  children,
  title,
  tables,
  views,
  interfacePages,
  dashboards,
  automations,
  userRole,
}: WorkspaceShellProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar
        tables={tables}
        views={views}
        interfacePages={interfacePages}
        dashboards={dashboards}
        automations={automations}
        userRole={userRole}
        isCollapsed={isCollapsed}
        onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar title={title} />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
