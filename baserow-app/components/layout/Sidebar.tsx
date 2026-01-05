"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  ChevronLeft,
  ChevronRight,
  Database,
  FileText,
  LayoutDashboard,
  Zap,
  ChevronDown,
  ChevronUp,
  Upload,
  Settings,
  Plus,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { Table, View, Automation } from "@/types/database"

interface InterfacePage {
  id: string
  name: string
  description?: string
  access_level: string
  allowed_roles?: string[]
  is_new_system?: boolean
}

interface Dashboard {
  id: string
  name: string
  description?: string
  access_level: string
  allowed_roles?: string[]
}

interface SidebarProps {
  tables: Table[]
  views: Record<string, View[]>
  interfacePages: InterfacePage[]
  dashboards: Dashboard[]
  automations: Automation[]
  userRole: "admin" | "editor" | "viewer" | null
  isCollapsed: boolean
  onToggleCollapse: () => void
}

export default function Sidebar({
  tables,
  views,
  interfacePages,
  dashboards,
  automations,
  userRole,
  isCollapsed,
  onToggleCollapse,
}: SidebarProps) {
  const pathname = usePathname()
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set())

  const toggleTable = (tableId: string) => {
    const newExpanded = new Set(expandedTables)
    if (newExpanded.has(tableId)) {
      newExpanded.delete(tableId)
    } else {
      newExpanded.add(tableId)
    }
    setExpandedTables(newExpanded)
  }

  const isActive = (path: string) => pathname === path || pathname?.startsWith(path + "/")

  const SidebarItem = ({
    href,
    icon: Icon,
    label,
    active = false,
    children,
  }: {
    href?: string
    icon: React.ElementType
    label: string
    active?: boolean
    children?: React.ReactNode
  }) => {
    const content = (
      <div
        className={cn(
          "flex items-center gap-3 px-3 py-2 rounded-md transition-colors",
          active
            ? "bg-gray-100 text-gray-900 font-medium"
            : "text-gray-700 hover:bg-gray-50",
          isCollapsed && "justify-center px-2"
        )}
      >
        <Icon className={cn("h-4 w-4 flex-shrink-0", isCollapsed && "mx-auto")} />
        {!isCollapsed && (
          <>
            <span className="flex-1 truncate">{label}</span>
            {children}
          </>
        )}
      </div>
    )

    if (href) {
      return (
        <Link href={href} className="block">
          {content}
        </Link>
      )
    }

    return content
  }

  return (
    <div
      className={cn(
        "bg-white border-r border-gray-200 flex flex-col transition-all duration-300",
        isCollapsed ? "w-16" : "w-60"
      )}
    >
      {/* Collapse toggle */}
      <div className="h-14 border-b border-gray-200 flex items-center justify-end px-3">
        <button
          onClick={onToggleCollapse}
          className="p-1.5 rounded-md hover:bg-gray-100 text-gray-600"
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Sidebar content */}
      <div className="flex-1 overflow-y-auto py-2">
        {/* Quick Actions */}
        {!isCollapsed && (
          <div className="mb-4 px-3">
            <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Quick Actions
            </div>
            <div className="space-y-0.5 mt-1">
              <SidebarItem
                href="/import"
                icon={Upload}
                label="Import CSV"
                active={isActive("/import")}
              />
            </div>
          </div>
        )}

        {/* Tables Section */}
        <div className="mb-4">
          {!isCollapsed && (
            <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Tables
            </div>
          )}
          <div className="space-y-0.5">
            {tables.map((table) => {
              const tableViews = views[table.id] || []
              const isExpanded = expandedTables.has(table.id)
              const isTableActive = isActive(`/tables/${table.id}`)

              return (
                <div key={table.id}>
                  <div
                    className={cn(
                      "flex items-center",
                      isCollapsed && "justify-center"
                    )}
                  >
                    {!isCollapsed && tableViews.length > 0 ? (
                      <button
                        onClick={() => toggleTable(table.id)}
                        className="flex-1"
                      >
                        <SidebarItem
                          icon={Database}
                          label={table.name}
                          active={isTableActive}
                        >
                          {isExpanded ? (
                            <ChevronUp className="h-3 w-3" />
                          ) : (
                            <ChevronDown className="h-3 w-3" />
                          )}
                        </SidebarItem>
                      </button>
                    ) : (
                      <SidebarItem
                        href={`/tables/${table.id}`}
                        icon={Database}
                        label={table.name}
                        active={isTableActive}
                      />
                    )}
                  </div>

                  {/* Views submenu */}
                  {!isCollapsed && isExpanded && tableViews.length > 0 && (
                    <div className="ml-4 mt-0.5 space-y-0.5">
                      {tableViews.map((view) => {
                        const isViewActive = isActive(
                          `/tables/${table.id}/views/${view.id}`
                        )
                        return (
                          <SidebarItem
                            key={view.id}
                            href={`/tables/${table.id}/views/${view.id}`}
                            icon={FileText}
                            label={view.name}
                            active={isViewActive}
                          />
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Interface Pages Section */}
          <div className="mb-4">
            {!isCollapsed && (
              <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Pages
              </div>
            )}
            <div className="space-y-0.5">
            {!isCollapsed && (
              <SidebarItem
                href="/interface/new"
                icon={Plus}
                label="New Page"
                active={isActive("/interface/new")}
              />
            )}
              {interfacePages.map((page) => {
                // Use /pages route for new system pages, /interface for old system pages
                const href = page.is_new_system ? `/pages/${page.id}` : `/interface/${page.id}`
                const isPageActive = isActive(href) || isActive(`/interface/${page.id}`) || isActive(`/pages/${page.id}`)
                return (
                  <SidebarItem
                    key={page.id}
                    href={href}
                    icon={FileText}
                    label={page.name}
                    active={isPageActive}
                  />
                )
              })}
            </div>
          </div>

        {/* Dashboards Section - Only for admin/editor */}
        {userRole && userRole !== "viewer" && dashboards.length > 0 && (
          <div className="mb-4">
            {!isCollapsed && (
              <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Dashboards
              </div>
            )}
            <div className="space-y-0.5">
              {dashboards.map((dashboard) => {
                const isDashboardActive = isActive(`/dashboard/${dashboard.id}`)
                return (
                  <SidebarItem
                    key={dashboard.id}
                    href={`/dashboard/${dashboard.id}`}
                    icon={LayoutDashboard}
                    label={dashboard.name}
                    active={isDashboardActive}
                  />
                )
              })}
            </div>
          </div>
        )}

        {/* Automations - Only for admin/editor */}
        {userRole && userRole !== "viewer" && (
          <div className="mb-4">
            {!isCollapsed && (
              <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Automations
              </div>
            )}
            {automations.length > 0 ? (
              <div className="space-y-0.5">
                {automations.map((automation) => {
                  const isAutomationActive = isActive(`/automations/${automation.id}`)
                  return (
                    <SidebarItem
                      key={automation.id}
                      href={`/automations/${automation.id}`}
                      icon={Zap}
                      label={automation.name}
                      active={isAutomationActive}
                    />
                  )
                })}
              </div>
            ) : (
              <SidebarItem
                href="/automations"
                icon={Zap}
                label="Automations"
                active={isActive("/automations")}
              />
            )}
          </div>
        )}

        {/* Settings - Always at bottom */}
        <div className="mt-auto border-t border-gray-200 pt-2">
          <SidebarItem
            href="/settings"
            icon={Settings}
            label="Settings"
            active={isActive("/settings")}
          />
        </div>
      </div>
    </div>
  )
}
