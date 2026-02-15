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
  Upload,
  Settings,
  Plus,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useBranding } from "@/contexts/BrandingContext"
import type { Table, View } from "@/types/database"
import PageCreationWizard from "@/components/interface/PageCreationWizard"

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
  userRole: "admin" | "editor" | "viewer" | null
  isCollapsed: boolean
  onToggleCollapse: () => void
}

export default function Sidebar({
  tables,
  views,
  interfacePages,
  dashboards,
  userRole,
  isCollapsed,
  onToggleCollapse,
}: SidebarProps) {
  const pathname = usePathname()
  const { primaryColor, sidebarTextColor } = useBranding()
  const [newPageWizardOpen, setNewPageWizardOpen] = useState(false)

  const isActive = (path: string): boolean =>
    Boolean(pathname && path && (pathname === path || pathname.startsWith(path + "/")))

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
            ? "bg-gray-100 font-medium"
            : "hover:bg-gray-50",
          isCollapsed && "justify-center px-2"
        )}
        style={{ color: active ? primaryColor : sidebarTextColor }}
      >
        <Icon className={cn("h-4 w-4 flex-shrink-0", isCollapsed && "mx-auto")} style={{ color: active ? primaryColor : sidebarTextColor }} />
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
        <Link href={href} prefetch={false} className="block">
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
          className="p-1.5 rounded-md hover:bg-gray-100"
          style={{ color: sidebarTextColor }}
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" style={{ color: sidebarTextColor }} />
          ) : (
            <ChevronLeft className="h-4 w-4" style={{ color: sidebarTextColor }} />
          )}
        </button>
      </div>

      {/* Sidebar content */}
      <div className="flex-1 overflow-y-auto py-2">
        {/* Quick Actions */}
        {!isCollapsed && (
          <div className="mb-4 px-3">
            <div className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider" style={{ color: sidebarTextColor }}>
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
              const isTableActive = isActive(`/tables/${table.id}`)

              return (
                <div key={table.id}>
                  <SidebarItem
                    href={`/tables/${table.id}`}
                    icon={Database}
                    label={table.name}
                    active={isTableActive}
                  />
                </div>
              )
            })}
          </div>
        </div>

        {/* Interface Pages Section */}
          <div className="mb-4">
            {!isCollapsed && (
              <div className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider" style={{ color: sidebarTextColor }}>
              Pages
              </div>
            )}
            <div className="space-y-0.5">
            {!isCollapsed && (
              <button
                onClick={() => setNewPageWizardOpen(true)}
                className="block w-full"
              >
                <SidebarItem
                  icon={Plus}
                  label="New Page"
                  active={false}
                />
              </button>
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
              <div className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider" style={{ color: sidebarTextColor }}>
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

      {/* Page Creation Wizard Modal */}
      <PageCreationWizard
        open={newPageWizardOpen}
        onOpenChange={setNewPageWizardOpen}
        defaultGroupId={null}
      />
    </div>
  )
}
