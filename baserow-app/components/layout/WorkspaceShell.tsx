"use client"

import { useState } from "react"
import Sidebar from "./Sidebar"
import Topbar from "./Topbar"
import type { Table, View } from "@/types/database"
import type { Page } from "@/lib/crud/pages"
import type { Dashboard } from "@/lib/crud/dashboards"

interface WorkspaceShellProps {
  children: React.ReactNode
  title?: string
  tables: Table[]
  views: Record<string, View[]>
  interfacePages: Page[]
  dashboards: Dashboard[]
  userRole: "admin" | "editor" | "viewer" | null
}

export default function WorkspaceShell({
  children,
  title,
  tables,
  views,
  interfacePages,
  dashboards,
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
