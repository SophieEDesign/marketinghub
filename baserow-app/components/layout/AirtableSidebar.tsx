"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
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
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useBranding } from "@/contexts/BrandingContext"
import { usePageActions } from "@/contexts/PageActionsContext"
import RecentsFavoritesSection from "./RecentsFavoritesSection"
import BaseDropdown from "./BaseDropdown"
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
  const router = useRouter()
  const { brandName, logoUrl, primaryColor, sidebarColor, sidebarTextColor } = useBranding()
  const { pageActions } = usePageActions()
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
  // Context-driven editing: no global edit mode; sidebar page reorder disabled for now
  const isEditMode = false

  const isInterfacePage = pathname.includes("/pages/")
  const isSettings = pathname.includes("/settings")
  const isTablePage = pathname.includes("/tables/")
  
  // Close sidebar on mobile when navigating.
  // Note: `popstate` only fires for back/forward, not Next.js Link navigations.
  // CRITICAL: Always close on navigation to prevent overlay from blocking clicks
  useEffect(() => {
    // Skip first render so we don't immediately close on initial load.
    if (previousPathnameRef.current === null) {
      previousPathnameRef.current = pathname
      return
    }

    if (previousPathnameRef.current !== pathname) {
      previousPathnameRef.current = pathname
      // CRITICAL: Always close sidebar on navigation (mobile) to prevent overlay blocking
      if (isMobile && isOpen) {
        if (onClose) {
          onClose()
        } else {
          // Fallback: close internally if no onClose provided
          setInternalCollapsed(true)
        }
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

  // On tablet/desktop: show collapsed state with BaseDropdown for Edit/View access
  if (!isMobile && isCollapsed) {
    return (
      <div 
        className="w-12 border-r border-black/10 flex flex-col items-center py-2 gap-2"
        style={{ backgroundColor: sidebarColor }}
      >
        <BaseDropdown
          variant="sidebar"
          collapsed
          className="flex items-center justify-center p-2 min-w-0 w-full bg-transparent hover:bg-black/10 border-0 shadow-none"
          triggerStyle={{ color: sidebarTextColor }}
          onOpenPageSettings={pageActions?.onOpenPageSettings}
          onEnterEdit={pageActions?.onEnterEdit}
          onExitEdit={pageActions?.onExitEdit}
          isEditing={pageActions?.isEditing}
        />
        <button
          onClick={() => setInternalCollapsed(false)}
          className="p-2 hover:bg-black/10 rounded transition-colors"
          style={{ color: sidebarTextColor }}
          title="Expand sidebar"
          aria-label="Expand sidebar"
        >
          <ChevronRight className="h-4 w-4" style={{ color: sidebarTextColor }} />
        </button>
      </div>
    )
  }

  return (
    <>
      {/* Overlay for mobile */}
      {isMobile && isOpen && (onClose || isOpenProp === undefined) && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 desktop:hidden"
          onClick={() => {
            // In controlled mode (mobile), parent should provide onClose.
            // In uncontrolled mode, fall back to collapsing internally so the overlay never "traps" clicks.
            if (onClose) onClose()
            else setInternalCollapsed(true)
          }}
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
      {/* Header with Edit menu (BaseDropdown) - moved from page level per user request */}
      <div className="px-4 py-3 border-b border-black/10 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <BaseDropdown
            variant="sidebar"
            className="flex items-center gap-2 font-semibold h-auto py-1 px-0 bg-transparent hover:bg-black/10 border-0 shadow-none text-left min-w-0"
            triggerStyle={{ color: sidebarTextColor }}
            onOpenPageSettings={pageActions?.onOpenPageSettings}
            onEnterEdit={pageActions?.onEnterEdit}
            onExitEdit={pageActions?.onExitEdit}
            isEditing={pageActions?.isEditing}
          />
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
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
            aria-label={isMobile ? "Close sidebar" : "Collapse sidebar"}
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
              router.refresh()
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
                  const targetPath = `/tables/${table.id}`
                  
                  return (
                    <Link
                      key={table.id}
                      href={targetPath}
                      className={cn(
                        "flex items-center gap-2 px-2 py-1.5 rounded transition-colors hover:bg-black/10",
                        isTableActive && "bg-black/20 font-medium"
                      )}
                      style={{ color: sidebarTextColor }}
                      onClick={(e) => {
                        const debugEnabled = typeof window !== "undefined" && localStorage.getItem("DEBUG_NAVIGATION") === "1"
                        const isCurrentlyActive = pathname === targetPath
                        
                        if (debugEnabled) {
                          console.log("[Table Link] Click detected:", {
                            href: targetPath,
                            currentPath: pathname,
                            isActive: isCurrentlyActive,
                            defaultPrevented: e.defaultPrevented,
                            target: e.target,
                            targetTag: (e.target as HTMLElement)?.tagName,
                            targetClasses: (e.target as HTMLElement)?.className,
                            currentElement: e.currentTarget,
                            currentElementTag: (e.currentTarget as HTMLElement)?.tagName,
                            timestamp: performance.now(),
                          })
                        }
                        
                        // If clicking the same page, force a refresh
                        if (isCurrentlyActive) {
                          if (debugEnabled) {
                            console.log("[Table Link] Already on this page - forcing refresh")
                          }
                          e.preventDefault()
                          e.stopPropagation()
                          router.refresh()
                          return
                        }
                        
                        // For navigation to different pages, let Next.js Link handle it
                        // Don't call preventDefault or stopPropagation - let the Link work normally
                        if (debugEnabled) {
                          console.log("[Table Link] Navigation allowed - letting Next.js Link handle it", {
                            willNavigate: !e.defaultPrevented,
                            eventPhase: e.eventPhase,
                            bubbles: e.bubbles,
                            cancelable: e.cancelable,
                          })
                          
                          // Track if navigation actually happens
                          const startTime = performance.now()
                          const initialPathname = pathname
                          
                          // Check multiple times to catch navigation at different stages
                          const checkNavigation = (attempt: number) => {
                            setTimeout(() => {
                              const newPathname = window.location.pathname
                              const elapsed = performance.now() - startTime
                              
                              if (newPathname === targetPath) {
                                console.log("[Table Link] ✅ Navigation completed successfully", {
                                  elapsed: `${elapsed.toFixed(2)}ms`,
                                  attempt,
                                  from: initialPathname,
                                  to: newPathname,
                                })
                              } else if (attempt < 3) {
                                // Check again (navigation might be in progress)
                                checkNavigation(attempt + 1)
                              } else {
                                // After 3 attempts (~300ms), navigation likely didn't happen
                                console.warn("[Table Link] ⚠️ Navigation did not occur after multiple checks", {
                                  elapsed: `${elapsed.toFixed(2)}ms`,
                                  expected: targetPath,
                                  actual: newPathname,
                                  stillOn: initialPathname,
                                })
                                // Fallback: use window.location for more reliable navigation
                                // This works even if the component is unmounting
                                console.log("[Table Link] Attempting manual navigation fallback...")
                                window.location.href = targetPath
                              }
                            }, 100)
                          }
                          checkNavigation(1)
                        }
                      }}
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
