"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import NewPageModal from "@/components/interface/NewPageModal"
import { 
  Table2, 
  ChevronRight, 
  ChevronDown, 
  Plus, 
  Grid3x3,
  FileText,
  Calendar,
  Layout,
  MoreVertical,
  X,
  Layers,
  Zap,
  Settings,
  Home,
  Upload
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import type { Table, View, Automation } from "@/types/database"

interface InterfacePage {
  id: string
  name: string
  description?: string
}

interface AirtableSidebarProps {
  tables: Table[]
  views: Record<string, View[]>
  interfacePages?: InterfacePage[]
  automations?: Automation[]
}

export default function AirtableSidebar({ 
  tables, 
  views, 
  interfacePages = [], 
  automations = [] 
}: AirtableSidebarProps) {
  const pathname = usePathname()
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set())
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["tables"]))
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [newPageModalOpen, setNewPageModalOpen] = useState(false)

  // Extract tableId and viewId from pathname
  const pathMatch = pathname.match(/\/tables\/([^\/]+)(?:\/views\/([^\/]+))?/)
  const currentTableId = pathMatch?.[1]
  const currentViewId = pathMatch?.[2]
  const isInterfacePage = pathname.includes("/pages/")
  const isAutomation = pathname.includes("/automations/")
  const isSettings = pathname.includes("/settings")

  // Auto-expand table if viewing one of its views
  useEffect(() => {
    if (currentTableId && !expandedTables.has(currentTableId)) {
      setExpandedTables(prev => new Set(prev).add(currentTableId))
    }
    if (currentTableId || currentViewId) {
      setExpandedSections(prev => new Set(prev).add("tables"))
    }
    if (isInterfacePage) {
      setExpandedSections(prev => new Set(prev).add("pages"))
    }
    if (isAutomation) {
      setExpandedSections(prev => new Set(prev).add("automations"))
    }
  }, [currentTableId, currentViewId, isInterfacePage, isAutomation])

  function toggleTable(tableId: string) {
    setExpandedTables(prev => {
      const next = new Set(prev)
      if (next.has(tableId)) {
        next.delete(tableId)
      } else {
        next.add(tableId)
      }
      return next
    })
  }

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

  async function handleNewTable() {
    const name = prompt("Enter table name:")
    if (!name) return

    const supabase = createClient()
    const { data, error } = await supabase
      .from("tables")
      .insert([{ name }])
      .select()
      .single()

    if (error) {
      console.error("Error creating table:", error)
      alert("Failed to create table")
    } else {
      window.location.href = `/tables/${data.id}`
    }
  }

  async function handleNewView(tableId: string) {
    const name = prompt("Enter view name:")
    if (!name) return

    const supabase = createClient()
    const { data, error } = await supabase
      .from("views")
      .insert([{ 
        table_id: tableId,
        name,
        type: "grid"
      }])
      .select()
      .single()

    if (error) {
      console.error("Error creating view:", error)
      alert("Failed to create view")
    } else {
      window.location.href = `/tables/${tableId}/views/${data.id}`
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
      {/* Header */}
      <div className="p-3 border-b border-gray-200 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <Home className="h-5 w-5 text-gray-700" />
          <span className="text-sm font-semibold text-gray-900">Workspace</span>
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
        {/* Quick Actions */}
        <div className="py-2 border-b border-gray-100">
          <div className="px-3 mb-1">
            <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Quick Actions
            </div>
          </div>
          <div className="space-y-0.5 px-2">
            <Link
              href="/import"
              className={`flex items-center gap-2 px-2 py-1.5 rounded transition-colors ${
                pathname.includes("/import")
                  ? "bg-blue-50 text-blue-700"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              <Upload className="h-4 w-4 flex-shrink-0" />
              <span className="text-sm">Import CSV</span>
            </Link>
          </div>
        </div>

        {/* Tables Section */}
        <div className="py-2">
          <div className="px-3 mb-1">
            <button
              onClick={() => toggleSection("tables")}
              className="w-full flex items-center justify-between px-2 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:bg-gray-50 rounded transition-colors"
            >
              <span>Tables</span>
              {expandedSections.has("tables") ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
            </button>
          </div>
          {expandedSections.has("tables") && (
            <>
              <div className="px-2 mb-1">
                <button
                  onClick={handleNewTable}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  <span>New Table</span>
                </button>
              </div>
              <div className="space-y-0.5 px-2">
                {tables.map((table) => {
                  const isExpanded = expandedTables.has(table.id)
                  const tableViews = views[table.id] || []
                  const isActive = currentTableId === table.id

                  return (
                    <div key={table.id} className="group">
                      <div className="flex items-center">
                        <button
                          onClick={() => toggleTable(table.id)}
                          className="p-1 hover:bg-gray-100 rounded transition-colors"
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-3.5 w-3.5 text-gray-500" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5 text-gray-500" />
                          )}
                        </button>
                        <Link
                          href={`/tables/${table.id}`}
                          className={`flex-1 flex items-center gap-2 px-2 py-1.5 rounded transition-colors ${
                            isActive && !currentViewId
                              ? "bg-blue-50 text-blue-700"
                              : "text-gray-700 hover:bg-gray-100"
                          }`}
                        >
                          <Table2 className="h-4 w-4 flex-shrink-0" />
                          <span className="text-sm font-medium truncate">{table.name}</span>
                        </Link>
                      </div>
                      {isExpanded && (
                        <div className="ml-6 space-y-0.5 mt-0.5">
                          {tableViews.map((view) => {
                            const isViewActive = currentViewId === view.id
                            return (
                              <Link
                                key={view.id}
                                href={`/tables/${table.id}/views/${view.id}`}
                                className={`flex items-center gap-2 px-2 py-1.5 rounded transition-colors ${
                                  isViewActive
                                    ? "bg-blue-50 text-blue-700"
                                    : "text-gray-600 hover:bg-gray-100"
                                }`}
                              >
                                {getViewIcon(view.type)}
                                <span className="text-sm truncate">{view.name}</span>
                              </Link>
                            )
                          })}
                          <button
                            onClick={() => handleNewView(table.id)}
                            className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-gray-500 hover:bg-gray-100 rounded transition-colors"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            <span>New View</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>

        {/* Interface Pages Section */}
        <div className="py-2 border-t border-gray-100">
          <div className="px-3 mb-1">
            <button
              onClick={() => toggleSection("pages")}
              className="w-full flex items-center justify-between px-2 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:bg-gray-50 rounded transition-colors"
            >
              <span>Pages</span>
              {expandedSections.has("pages") ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
            </button>
          </div>
          {expandedSections.has("pages") && (
            <>
              <div className="px-2 mb-1">
                <button
                  onClick={() => setNewPageModalOpen(true)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  <span>New Page</span>
                </button>
              </div>
              <div className="space-y-0.5 px-2">
                {interfacePages.map((page) => {
                  const isActive = pathname.includes(`/pages/${page.id}`) || pathname.includes(`/interface/${page.id}`)
                  return (
                    <Link
                      key={page.id}
                      href={`/interface/${page.id}`}
                      className={`flex items-center gap-2 px-2 py-1.5 rounded transition-colors ${
                        isActive
                          ? "bg-blue-50 text-blue-700"
                          : "text-gray-600 hover:bg-gray-100"
                      }`}
                    >
                      <Layers className="h-4 w-4 flex-shrink-0" />
                      <span className="text-sm truncate">{page.name}</span>
                    </Link>
                  )
                })}
              </div>
            </>
          )}
        </div>

        {/* Automations Section */}
        <div className="py-2 border-t border-gray-100">
          <div className="px-3 mb-1">
            <button
              onClick={() => toggleSection("automations")}
              className="w-full flex items-center justify-between px-2 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:bg-gray-50 rounded transition-colors"
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
            <div className="space-y-0.5 px-2">
              {automations.map((automation) => {
                const isActive = pathname.includes(`/automations/${automation.id}`)
                return (
                  <Link
                    key={automation.id}
                    href={`/automations/${automation.id}`}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded transition-colors ${
                      isActive
                        ? "bg-blue-50 text-blue-700"
                        : "text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    <Zap className="h-4 w-4 flex-shrink-0" />
                    <span className="text-sm truncate">{automation.name}</span>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {/* Settings */}
        <div className="py-2 border-t border-gray-100">
          <Link
            href="/settings"
            className={`flex items-center gap-2 px-3 py-1.5 rounded transition-colors ${
              isSettings
                ? "bg-blue-50 text-blue-700"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            <Settings className="h-4 w-4 flex-shrink-0" />
            <span className="text-sm">Settings</span>
          </Link>
        </div>
      </div>

      {/* New Page Modal */}
      <NewPageModal open={newPageModalOpen} onOpenChange={setNewPageModalOpen} />
    </div>
  )
}
