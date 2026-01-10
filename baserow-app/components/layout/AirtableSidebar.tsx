"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import PageCreationWizard from "@/components/interface/PageCreationWizard"
import GroupedInterfaces from "./GroupedInterfaces"
import { 
  ChevronRight, 
  ChevronDown, 
  Plus, 
  X,
  Settings,
  Home,
  Database,
  Edit2,
  Check,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useBranding } from "@/contexts/BrandingContext"
import { useSidebarMode } from "@/contexts/SidebarModeContext"
import RecentsFavoritesSection from "./RecentsFavoritesSection"
import type { Automation, Table, View } from "@/types/database"

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
  tables?: Table[]
  views?: Record<string, View[]>
  userRole?: 'admin' | 'member' | null
}

export default function AirtableSidebar({ 
  interfacePages = [], 
  interfaceGroups = [],
  tables = [],
  views = {},
  userRole = null
}: AirtableSidebarProps) {
  const pathname = usePathname()
  const { brandName, logoUrl, primaryColor, sidebarColor } = useBranding()
  const { mode, toggleMode } = useSidebarMode()
  // Interfaces expanded by default
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["interfaces"])
  )
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [newPageModalOpen, setNewPageModalOpen] = useState(false)
  
  const isAdmin = userRole === 'admin'
  const isEditMode = mode === "edit"

  const isInterfacePage = pathname.includes("/pages/")
  const isSettings = pathname.includes("/settings")
  const isTablePage = pathname.includes("/tables/")

  // Auto-expand sections based on current route
  useEffect(() => {
    if (isInterfacePage) {
      setExpandedSections(prev => new Set(prev).add("interfaces"))
    }
    if (isTablePage) {
      setExpandedSections(prev => new Set(prev).add("core-data"))
    }
  }, [isInterfacePage, isTablePage, pathname])

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


  if (isCollapsed) {
    return (
      <div 
        className="w-12 border-r border-gray-200 flex flex-col items-center py-2"
        style={{ backgroundColor: sidebarColor }}
      >
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
    <div 
      className="w-64 border-r border-gray-200 flex flex-col h-screen shadow-sm"
      style={{ backgroundColor: sidebarColor }}
    >
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
          <div className="px-3 mb-1 flex items-center justify-between gap-2">
            <button
              onClick={() => toggleSection("interfaces")}
              className="flex-1 flex items-center justify-between px-2 py-1.5 text-xs font-semibold text-gray-700 uppercase tracking-wider hover:bg-gray-50 rounded transition-colors"
            >
              <span>Interfaces</span>
              {expandedSections.has("interfaces") ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
            </button>
            {expandedSections.has("interfaces") && (
              <button
                onClick={toggleMode}
                className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                  isEditMode
                    ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
                title={isEditMode ? "Done editing" : "Edit interfaces"}
              >
                {isEditMode ? (
                  <>
                    <Check className="h-3 w-3 inline mr-1" />
                    Done
                  </>
                ) : (
                  <>
                    <Edit2 className="h-3 w-3 inline mr-1" />
                    Edit
                  </>
                )}
              </button>
            )}
          </div>
          {expandedSections.has("interfaces") && (
            <GroupedInterfaces
              interfacePages={interfacePages}
              interfaceGroups={interfaceGroups}
              editMode={isEditMode}
              onRefresh={() => {
                window.dispatchEvent(new CustomEvent('pages-updated'))
                window.location.reload()
              }}
            />
          )}
        </div>



        {/* Recents & Favorites */}
        <RecentsFavoritesSection primaryColor={primaryColor} />

        {/* Core Data Section - Collapsed by default */}
        {tables.length > 0 && (
          <div className="py-2 border-t border-gray-100">
            <div className="px-3 mb-1">
              <button
                onClick={() => toggleSection("core-data")}
                className="w-full flex items-center justify-between px-2 py-1.5 text-xs font-semibold text-gray-700 uppercase tracking-wider hover:bg-gray-50 rounded transition-colors"
              >
                <span>Core Data</span>
                {expandedSections.has("core-data") ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
              </button>
            </div>
            {expandedSections.has("core-data") && (
              <div className="space-y-0.5 px-2">
                {tables.map((table) => {
                  const isTableActive = pathname.includes(`/tables/${table.id}`)
                  
                  return (
                    <Link
                      key={table.id}
                      href={`/tables/${table.id}`}
                      className="flex items-center gap-2 px-2 py-1.5 rounded transition-colors text-gray-600 hover:bg-gray-100"
                      style={isTableActive ? { 
                        backgroundColor: primaryColor + '15', 
                        color: primaryColor 
                      } : {}}
                    >
                      <Database className="h-4 w-4 flex-shrink-0" />
                      <span className="text-sm truncate">{table.name}</span>
                    </Link>
                  )
                })}
              </div>
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
      <PageCreationWizard open={newPageModalOpen} onOpenChange={setNewPageModalOpen} defaultGroupId={null} />
    </div>
  )
}
