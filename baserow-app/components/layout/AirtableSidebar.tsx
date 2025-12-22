"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import NewPageModal from "@/components/interface/NewPageModal"
import GroupedInterfaces from "./GroupedInterfaces"
import { 
  ChevronRight, 
  ChevronDown, 
  Plus, 
  X,
  Zap,
  Settings,
  Home,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useBranding } from "@/contexts/BrandingContext"
import type { Automation } from "@/types/database"

interface InterfacePage {
  id: string
  name: string
  description?: string
  group_id?: string | null
  order_index?: number
}

interface InterfaceGroup {
  id: string
  name: string
  order_index: number
  collapsed: boolean
  workspace_id?: string | null
}

interface AirtableSidebarProps {
  interfacePages?: InterfacePage[]
  interfaceGroups?: InterfaceGroup[]
  automations?: Automation[]
  userRole?: 'admin' | 'member' | null
}

export default function AirtableSidebar({ 
  interfacePages = [], 
  interfaceGroups = [],
  automations = [],
  userRole = null
}: AirtableSidebarProps) {
  const pathname = usePathname()
  const { brandName, logoUrl, primaryColor } = useBranding()
  // Interfaces and Automations expanded by default (only for admins)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(userRole === 'admin' ? ["interfaces", "automations"] : ["interfaces"])
  )
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [newPageModalOpen, setNewPageModalOpen] = useState(false)
  
  const isAdmin = userRole === 'admin'

  const isInterfacePage = pathname.includes("/pages/")
  const isAutomation = pathname.includes("/automations/")
  const isSettings = pathname.includes("/settings")

  // Auto-expand sections based on current route
  useEffect(() => {
    if (isInterfacePage) {
      setExpandedSections(prev => new Set(prev).add("interfaces"))
    }
    if (isAutomation || pathname === "/automations") {
      setExpandedSections(prev => new Set(prev).add("automations"))
    }
  }, [isInterfacePage, isAutomation, pathname])

  function toggleSection(section: string) {
    setExpandedSections(prev => {
      const next = new Set(prev)
      if (next.has(section)) {
        next.delete(section)
      } else {
        next.add(section)
      }
      return next
    })
  }

  function getViewIcon(type: string) {
    switch (type) {
      case "grid":
        return <Grid3x3 className="h-3.5 w-3.5" />
      case "form":
        return <FileText className="h-3.5 w-3.5" />
      case "kanban":
        return <Layout className="h-3.5 w-3.5" />
      case "calendar":
        return <Calendar className="h-3.5 w-3.5" />
      default:
        return <Grid3x3 className="h-3.5 w-3.5" />
    }
  }


  if (isCollapsed) {
    return (
      <div className="w-12 bg-white border-r border-gray-200 flex flex-col items-center py-2">
        <button
          onClick={() => setIsCollapsed(false)}
          className="p-2 hover:bg-gray-100 rounded transition-colors"
          title="Expand sidebar"
        >
          <ChevronRight className="h-4 w-4 text-gray-600" />
        </button>
      </div>
    )
  }

  return (
    <div className="w-64 bg-white border-r border-gray-200 flex flex-col h-screen shadow-sm">
      {/* Header with Branding */}
      <div className="p-3 border-b border-gray-200 flex items-center justify-between" style={{ borderBottomColor: primaryColor + '20' }}>
        <Link href="/" className="flex items-center gap-2">
          {logoUrl ? (
            <div className="relative h-5 w-5">
              <Image
                src={logoUrl}
                alt={brandName}
                fill
                className="object-contain"
                unoptimized
              />
            </div>
          ) : (
            <Home className="h-5 w-5" style={{ color: primaryColor }} />
          )}
          <span className="text-sm font-semibold" style={{ color: primaryColor }}>
            {brandName}
          </span>
        </Link>
        <button
          onClick={() => setIsCollapsed(true)}
          className="p-1 hover:bg-gray-100 rounded transition-colors"
          title="Collapse sidebar"
        >
          <X className="h-4 w-4 text-gray-600" />
        </button>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto">
        {/* Interfaces Section - Primary Navigation */}
        <div className="py-2 border-b border-gray-200">
          <div className="px-3 mb-1">
            <button
              onClick={() => toggleSection("interfaces")}
              className="w-full flex items-center justify-between px-2 py-1.5 text-xs font-semibold text-gray-700 uppercase tracking-wider hover:bg-gray-50 rounded transition-colors"
            >
              <span>Interfaces</span>
              {expandedSections.has("interfaces") ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
            </button>
          </div>
          {expandedSections.has("interfaces") && (
            <GroupedInterfaces
              interfacePages={interfacePages}
              interfaceGroups={interfaceGroups}
              onRefresh={() => {
                window.dispatchEvent(new CustomEvent('pages-updated'))
                window.location.reload()
              }}
            />
          )}
        </div>

        {/* Automations Section - Admin Only */}
        {isAdmin && (
        <div className="py-2 border-t border-gray-100">
          <div className="px-3 mb-1">
            <button
              onClick={() => toggleSection("automations")}
              className="w-full flex items-center justify-between px-2 py-1.5 text-xs font-semibold text-gray-700 uppercase tracking-wider hover:bg-gray-50 rounded transition-colors"
            >
              <span>Automations</span>
              {expandedSections.has("automations") ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
            </button>
          </div>
          {expandedSections.has("automations") && (
            <>
              <div className="px-2 mb-1">
                <Link
                  href="/automations"
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  <span>New Automation</span>
                </Link>
              </div>
              <div className="space-y-0.5 px-2">
                <Link
                  href="/automations"
                  className="flex items-center gap-2 px-2 py-1.5 rounded transition-colors text-gray-600 hover:bg-gray-100"
                  style={pathname === "/automations" ? { 
                    backgroundColor: primaryColor + '15', 
                    color: primaryColor 
                  } : {}}
                >
                  <Zap className="h-4 w-4 flex-shrink-0" />
                  <span className="text-sm">All Automations</span>
                </Link>
                {automations.map((automation) => {
                  const isActive = pathname.includes(`/automations/${automation.id}`)
                  return (
                    <Link
                      key={automation.id}
                      href={`/automations/${automation.id}`}
                      className="flex items-center gap-2 px-2 py-1.5 rounded transition-colors text-gray-600 hover:bg-gray-100"
                      style={isActive ? { 
                        backgroundColor: primaryColor + '15', 
                        color: primaryColor 
                      } : {}}
                    >
                      <Zap className="h-4 w-4 flex-shrink-0" />
                      <span className="text-sm truncate">{automation.name}</span>
                    </Link>
                  )
                })}
              </div>
            </>
          )}
        </div>
        )}


        {/* Settings - Admin Only */}
        {isAdmin && (
        <div className="py-2 border-t border-gray-100">
          <Link
            href="/settings"
            className={`flex items-center gap-2 px-3 py-1.5 rounded transition-colors ${
              isSettings
                ? "bg-blue-50 text-blue-700"
                : "text-gray-600 hover:bg-gray-100"
            }`}
            style={isSettings ? { backgroundColor: primaryColor + '15', color: primaryColor } : {}}
          >
            <Settings className="h-4 w-4 flex-shrink-0" />
            <span className="text-sm">Settings</span>
          </Link>
        </div>
        )}
      </div>

      {/* New Page Modal */}
      <NewPageModal open={newPageModalOpen} onOpenChange={setNewPageModalOpen} />
    </div>
  )
}
