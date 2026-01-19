"use client"

import { useState, useEffect, useRef } from "react"
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
import { cn } from "@/lib/utils"
import { useIsMobile } from "@/hooks/useResponsive"
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
  icon?: string | null
}

interface AirtableSidebarProps {
  interfacePages?: InterfacePage[]
  interfaceGroups?: InterfaceGroup[]
  tables?: Table[]
  views?: Record<string, View[]>
  userRole?: 'admin' | 'member' | null
  isOpen?: boolean
  onClose?: () => void
}

export default function AirtableSidebar({ 
  interfacePages = [], 
  interfaceGroups = [],
  tables = [],
  views = {},
  userRole = null,
  isOpen: isOpenProp,
  onClose
}: AirtableSidebarProps) {
  const pathname = usePathname()
  const { brandName, logoUrl, primaryColor, sidebarColor, sidebarTextColor } = useBranding()
  const { mode, toggleMode } = useSidebarMode()
  const isMobile = useIsMobile()
  const previousPathnameRef = useRef<string | null>(null)
  
  // Load initial state - use default on server, sync from localStorage on client after mount
  // This prevents hydration mismatches
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["interfaces"]))
  const [isMounted, setIsMounted] = useState(false)
  
  // Sync from localStorage after mount to prevent hydration issues
  useEffect(() => {
    setIsMounted(true)
    const saved = localStorage.getItem("sidebar-sections-expanded")
    if (saved) {
      try {
        setExpandedSections(new Set(JSON.parse(saved)))
      } catch (e) {
        // Ignore parse errors
      }
    }
  }, [])
  
  // For mobile/tablet: use controlled state from parent, default to closed
  // For desktop: use internal collapsed state
  const [internalCollapsed, setInternalCollapsed] = useState(false)
  const [newPageModalOpen, setNewPageModalOpen] = useState(false)
  
  // Determine if sidebar should be visible
  const isOpen = isOpenProp !== undefined ? isOpenProp : !internalCollapsed
  const isCollapsed = isMobile ? !isOpen : internalCollapsed
  
  const isAdmin = userRole === 'admin'
  const isEditMode = mode === "edit"

  const isInterfacePage = pathname.includes("/pages/")
  const isSettings = pathname.includes("/settings")
  const isTablePage = pathname.includes("/tables/")
  
  // Close sidebar on mobile when navigating.
  // Note: `popstate` only fires for back/forward, not Next.js Link navigations.
  useEffect(() => {
    // Skip first render so we don't immediately close on initial load.
    if (previousPathnameRef.current === null) {
      previousPathnameRef.current = pathname
      return
    }

    if (previousPathnameRef.current !== pathname) {
      previousPathnameRef.current = pathname
      if (isMobile && isOpen && onClose) {
        onClose()
      }
    }
  }, [pathname, isMobile, isOpen, onClose])

  // Save expand/collapse state to localStorage when it changes (only after mount)
  useEffect(() => {
    if (isMounted) {
      localStorage.setItem("sidebar-sections-expanded", JSON.stringify(Array.from(expandedSections)))
    }
  }, [expandedSections, isMounted])

  function toggleSection(section: string) {
    setExpandedSections(prev => {
      const next = new Set(prev)
      if (next.has(section)) {
        next.delete(section)
      } else {
        next.add(section)
      }
      // Persist to localStorage (only after mount to avoid hydration issues)
      if (isMounted) {
        localStorage.setItem("sidebar-sections-expanded", JSON.stringify(Array.from(next)))
      }
      return next
    })
  }


  // On mobile: if closed, don't render (toggle button is in Topbar)
  if (isMobile && !isOpen) {
    return null
  }

  // On tablet/desktop: show collapsed state
  if (!isMobile && isCollapsed) {
    return (
      <div 
        className="w-12 border-r border-black/10 flex flex-col items-center py-2"
        style={{ backgroundColor: sidebarColor }}
      >
        <button
          onClick={() => setInternalCollapsed(false)}
          className="p-2 hover:bg-black/10 rounded transition-colors"
          style={{ color: sidebarTextColor }}
          title="Expand sidebar"
        >
          <ChevronRight className="h-4 w-4" style={{ color: sidebarTextColor }} />
        </button>
      </div>
    )
  }

  return (
    <>
      {/* Overlay for mobile */}
      {isMobile && isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 desktop:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      
      <div 
        data-sidebar
        className={cn(
          "flex flex-col h-screen shadow-sm transition-transform duration-300",
          isMobile 
            ? "fixed left-0 top-0 z-50 w-64" 
            : "relative w-64",
          isMobile && !isOpen && "-translate-x-full"
        )}
        style={{ backgroundColor: sidebarColor }}
      >
      {/* Header with Branding */}
      <div className="px-4 py-3 border-b border-black/10 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 min-w-0">
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
            <Home className="h-5 w-5" style={{ color: sidebarTextColor }} />
          )}
          <span className="text-sm font-semibold truncate" style={{ color: sidebarTextColor }}>
            {brandName}
          </span>
        </Link>
        <div className="flex items-center gap-1">
          <button
            onClick={toggleMode}
            className={cn(
              "h-8 px-2 text-xs font-medium rounded transition-colors flex items-center gap-1",
              isEditMode ? "bg-black/20 hover:bg-black/25" : "hover:bg-black/10"
            )}
            style={{ color: sidebarTextColor }}
            title={isEditMode ? "Done editing" : "Edit sidebar"}
          >
            {isEditMode ? (
              <>
                <Check className="h-3 w-3" />
                <span>Done</span>
              </>
            ) : (
              <>
                <Edit2 className="h-3 w-3" />
                <span>Edit</span>
              </>
            )}
          </button>
          <button
            onClick={() => {
              if (isMobile && onClose) {
                onClose()
              } else {
                setInternalCollapsed(true)
              }
            }}
            className="p-1 hover:bg-black/10 rounded transition-colors"
            style={{ color: sidebarTextColor }}
            title={isMobile ? "Close sidebar" : "Collapse sidebar"}
          >
            <X className="h-4 w-4" style={{ color: sidebarTextColor }} />
          </button>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto">
        {/* Primary Navigation (Airtable-style) */}
        <div className="py-2">
          <GroupedInterfaces
            interfacePages={interfacePages}
            interfaceGroups={interfaceGroups}
            editMode={isEditMode}
            onRefresh={() => {
              window.dispatchEvent(new CustomEvent('pages-updated'))
              window.location.reload()
            }}
          />
        </div>

        {/* Recents & Favorites */}
        <RecentsFavoritesSection primaryColor={primaryColor} sidebarTextColor={sidebarTextColor} />

        {/* Debug: Show tables count in development */}
        {process.env.NODE_ENV === 'development' && (
          <div className="px-3 py-1 text-xs opacity-70 border-t border-black/10" style={{ color: sidebarTextColor }}>
            Debug: tables.length = {tables.length}
            {tables.length > 0 && (
              <div className="mt-1">Tables: {tables.map(t => t.name).join(', ')}</div>
            )}
          </div>
        )}

        {/* Core Data Section - Admin only */}
        {isAdmin && tables.length > 0 && (
          <div className="py-2 border-t border-black/10">
            <div className="px-3 mb-1">
              <button
                onClick={() => toggleSection("core-data")}
                className="w-full flex items-center justify-between px-2 py-1.5 text-xs font-semibold uppercase tracking-wider hover:bg-black/10 rounded transition-colors"
                style={{ color: sidebarTextColor }}
              >
                <span>Core Data</span>
                {expandedSections.has("core-data") ? (
                  <ChevronDown className="h-3 w-3 flex-shrink-0" style={{ color: sidebarTextColor }} />
                ) : (
                  <ChevronRight className="h-3 w-3 flex-shrink-0" style={{ color: sidebarTextColor }} />
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
                      className={cn(
                        "flex items-center gap-2 px-2 py-1.5 rounded transition-colors hover:bg-black/10",
                        isTableActive && "bg-black/20 font-medium"
                      )}
                      style={{ color: sidebarTextColor }}
                    >
                      <Database className="h-4 w-4 flex-shrink-0" style={{ color: sidebarTextColor }} />
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
        <div className="py-2 border-t border-black/10">
          <Link
            href="/settings"
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded transition-colors hover:bg-black/10",
              isSettings && "bg-black/20 font-medium"
            )}
            style={{ color: sidebarTextColor }}
          >
            <Settings className="h-4 w-4 flex-shrink-0" style={{ color: sidebarTextColor }} />
            <span className="text-sm">Settings</span>
          </Link>
        </div>
        )}
      </div>

      {/* New Page Modal */}
      <PageCreationWizard open={newPageModalOpen} onOpenChange={setNewPageModalOpen} defaultGroupId={null} />
      </div>
    </>
  )
}
