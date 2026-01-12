"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useBranding } from "@/contexts/BrandingContext"
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
  useDroppable,
} from "@dnd-kit/core"
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  Plus,
  ChevronDown,
  ChevronRight,
  Edit2,
  Trash2,
  GripVertical,
  Layers,
  X,
  Folder,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import PageCreationWizard from "@/components/interface/PageCreationWizard"

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
  is_system?: boolean
}

interface GroupedInterfacesProps {
  interfacePages: InterfacePage[]
  interfaceGroups: InterfaceGroup[]
  editMode?: boolean
  onRefresh?: () => void
}

export default function GroupedInterfaces({
  interfacePages,
  interfaceGroups: initialGroups,
  editMode = false,
  onRefresh,
}: GroupedInterfacesProps) {
  const pathname = usePathname()
  const { primaryColor, sidebarTextColor } = useBranding()
  // Filter out any null/undefined groups (safety check)
  const [groups, setGroups] = useState<InterfaceGroup[]>(initialGroups.filter(g => g && g.id))
  const [pages, setPages] = useState<InterfacePage[]>(interfacePages)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())

  // Ensure we have an "Ungrouped" group if pages exist without group_id
  // This handles the case where the migration hasn't run yet or pages exist without groups
  const ungroupedGroupId = useMemo(() => {
    // First, try to find existing "Ungrouped" group
    const ungroupedGroup = groups.find(g => g.is_system && g.name === 'Ungrouped')
    if (ungroupedGroup) return ungroupedGroup.id
    
    // If no ungrouped group exists, check if we have pages without group_id
    const hasUngroupedPages = pages.some(p => !p.group_id)
    if (hasUngroupedPages) {
      // Return virtual ID - we'll create the group in allGroups
      return 'ungrouped-system-virtual'
    }
    
    // Default fallback ID (shouldn't happen, but ensures we always have an ID)
    return 'ungrouped-system-virtual'
  }, [groups, pages])
  
  // Add virtual "Ungrouped" group to groups list if needed
  const allGroups = useMemo(() => {
    if (ungroupedGroupId === 'ungrouped-system-virtual' && !groups.some(g => g.id === 'ungrouped-system-virtual')) {
      return [...groups, {
        id: 'ungrouped-system-virtual',
        name: 'Ungrouped',
        order_index: 9999,
        collapsed: false,
        is_system: true,
      } as InterfaceGroup]
    }
    return groups
  }, [groups, ungroupedGroupId])
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null)
  const [editingPageId, setEditingPageId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState("")
  const [activeId, setActiveId] = useState<string | null>(null)
  const [newPageModalOpen, setNewPageModalOpen] = useState(false)
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Load collapse state from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("interface-groups-collapsed")
    if (saved) {
      try {
        const collapsed = JSON.parse(saved)
        setCollapsedGroups(new Set(collapsed))
      } catch (e) {
        // Ignore parse errors
      }
    }
  }, [])

  // Save collapse state to localStorage
  const saveCollapseState = useCallback((collapsed: Set<string>) => {
    localStorage.setItem("interface-groups-collapsed", JSON.stringify(Array.from(collapsed)))
  }, [])

  // Organize pages by group
  // Pages without group_id go to "Ungrouped" system group
  const pagesByGroup = useMemo(() => {
    const result: Record<string, InterfacePage[]> = {}
    
    pages.forEach(page => {
      // If page has no group_id, assign to "Ungrouped" system group
      const groupId = page.group_id || ungroupedGroupId || 'ungrouped-system-virtual'
      if (!result[groupId]) {
        result[groupId] = []
      }
      result[groupId].push(page)
    })
    
    // Sort pages within each group by order_index
    Object.keys(result).forEach((groupId) => {
      result[groupId].sort((a, b) => (a.order_index || 0) - (b.order_index || 0))
    })
    
    return result
  }, [pages, ungroupedGroupId])

  // Get uncategorized pages (but we won't show them in a separate section)
  const uncategorizedPages = pagesByGroup["uncategorized"] || []

  // Filter groups based on mode
  // In Browse mode, hide system groups (like "Ungrouped") BUT only if they're empty
  // In Edit mode, show all groups including system groups
  const visibleGroups = useMemo(() => {
    if (editMode) {
      return allGroups
    }
    
    // In Browse mode, show system groups only if they have pages
    // Handle case where is_system might be undefined (column doesn't exist yet)
    return allGroups.filter(g => {
      const isSystemGroup = g.is_system === true || (g.name === 'Ungrouped' && g.id === ungroupedGroupId)
      if (isSystemGroup) {
        const groupPages = pagesByGroup[g.id] || []
        return groupPages.length > 0 // Show system groups if they have pages
      }
      return true // Show all non-system groups
    })
  }, [editMode, allGroups, pagesByGroup, ungroupedGroupId])

  // Sort groups by order_index (system groups go to end)
  const sortedGroups = useMemo(() => {
    return [...visibleGroups].sort((a, b) => {
      // System groups go to end
      if (a.is_system && !b.is_system) return 1
      if (!a.is_system && b.is_system) return -1
      return a.order_index - b.order_index
    })
  }, [visibleGroups])

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(groupId)) {
        next.delete(groupId)
      } else {
        next.add(groupId)
      }
      saveCollapseState(next)
      return next
    })
  }

  const handleStartEditGroup = (group: InterfaceGroup) => {
    setEditingGroupId(group.id)
    setEditingName(group.name)
  }

  const handleSaveGroup = async (groupId: string) => {
    if (!editingName.trim()) {
      setEditingGroupId(null)
      return
    }

    try {
      const response = await fetch(`/api/interface-groups/${groupId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editingName.trim() }),
      })

      if (response.ok) {
        setGroups((prev) =>
          prev.map((g) => (g.id === groupId ? { ...g, name: editingName.trim() } : g))
        )
        setEditingGroupId(null)
        onRefresh?.()
      } else {
        console.warn("Failed to update group:", response.status, response.statusText)
        // Silently fail - groups might not be available
      }
    } catch (error) {
      console.warn("Failed to update group:", error)
      // Silently fail - groups are optional
    }
  }

  const handleDeleteGroup = async (groupId: string) => {
    const group = groups.find(g => g.id === groupId)
    
    // Prevent deleting system groups
    if (group?.is_system) {
      alert("Cannot delete system groups")
      return
    }

    if (!confirm("Delete this Interface? Pages will be moved to Ungrouped Interface.")) {
      return
    }

    try {
      // Find the "Ungrouped" system Interface
      const ungroupedGroup = groups.find(g => g.is_system && g.name === 'Ungrouped')
      
      if (!ungroupedGroup) {
        alert("Cannot find Ungrouped Interface. Please refresh the page.")
        return
      }

      // Move pages to Ungrouped Interface
      const pagesToMove = pages.filter(p => p.group_id === groupId)
      await Promise.all(
        pagesToMove.map(page =>
          fetch(`/api/pages/${page.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ group_id: ungroupedGroup.id }),
          })
        )
      )

      // Delete the group
      const response = await fetch(`/api/interface-groups/${groupId}`, {
        method: "DELETE",
      })

      if (response.ok) {
        setGroups((prev) => prev.filter((g) => g.id !== groupId))
        setPages((prev) => prev.map((p) => (p.group_id === groupId ? { ...p, group_id: ungroupedGroup.id } : p)))
        onRefresh?.()
      } else {
        console.warn("Failed to delete group:", response.status, response.statusText)
      }
    } catch (error) {
      console.warn("Failed to delete group:", error)
      alert("Failed to delete group. Please try again.")
    }
  }

  const handleStartEditPage = (page: InterfacePage) => {
    setEditingPageId(page.id)
    setEditingName(page.name)
  }

  const handleSavePage = async (pageId: string) => {
    if (!editingName.trim()) {
      setEditingPageId(null)
      return
    }

    try {
      const response = await fetch(`/api/pages/${pageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editingName.trim() }),
      })

      if (response.ok) {
        setPages((prev) =>
          prev.map((p) => (p.id === pageId ? { ...p, name: editingName.trim() } : p))
        )
        setEditingPageId(null)
        onRefresh?.()
      }
    } catch (error) {
      console.error("Failed to update interface:", error)
    }
  }

  const handleDeletePage = async (pageId: string) => {
    const page = pages.find(p => p.id === pageId)
    if (!page) return

    if (!confirm(`Are you sure you want to delete "${page.name}"? This action cannot be undone.`)) {
      return
    }

    try {
      const response = await fetch(`/api/interface-pages/${pageId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete page')
      }

      // Remove from local state
      setPages((prev) => prev.filter((p) => p.id !== pageId))
      
      // If we're on the deleted page, redirect to home
      if (pathname.includes(`/pages/${pageId}`)) {
        window.location.href = '/'
      } else {
        onRefresh?.()
      }
    } catch (error: any) {
      console.error('Error deleting page:', error)
      alert(error.message || 'Failed to delete page. Make sure you have permission to delete pages.')
    }
  }

  const handleCreateGroup = async () => {
    // Create with default name, then immediately edit
    const defaultName = "New Group"
    
    try {
      const response = await fetch("/api/interface-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: defaultName }),
      })

      if (response.ok) {
        const { group } = await response.json()
        
        // Check if group was actually created (might be null if table doesn't exist)
        if (!group || !group.id) {
          // Silently fail - table might not exist yet (migration not run)
          console.warn("Failed to create group: table may not exist or RLS blocking")
          return
        }
        
        setGroups((prev) => {
          // Safety check: only add if group is valid
          if (!group || !group.id) return prev
          return [...prev, group]
        })
        // Immediately start editing
        setEditingGroupId(group.id)
        setEditingName(defaultName)
        // Expand the group so user can see it
        setCollapsedGroups((prev) => {
          const next = new Set(prev)
          next.delete(group.id)
          saveCollapseState(next)
          return next
        })
        onRefresh?.()
      } else {
        // Silently fail - table might not exist yet (migration not run)
        // User can still use interfaces without groups
        console.warn("Failed to create group:", response.status, response.statusText)
        // Don't show alert - groups are optional
      }
    } catch (error) {
      // Silently fail - groups are optional feature
      console.warn("Failed to create group:", error)
    }
  }

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)

    if (!over) return

    const activeId = active.id as string
    const overId = over.id as string

    // Handle group reordering
    if (activeId.startsWith("group-") && overId.startsWith("group-")) {
      const activeGroupId = activeId.replace("group-", "")
      const overGroupId = overId.replace("group-", "")

      const activeIndex = sortedGroups.findIndex((g) => g.id === activeGroupId)
      const overIndex = sortedGroups.findIndex((g) => g.id === overGroupId)

      if (activeIndex !== overIndex) {
        const newGroups = [...sortedGroups]
        const [removed] = newGroups.splice(activeIndex, 1)
        newGroups.splice(overIndex, 0, removed)

        const groupIds = newGroups.map((g) => g.id)
        try {
          await fetch("/api/interface-groups/reorder", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ groupIds }),
          })

          setGroups(newGroups.map((g, i) => ({ ...g, order_index: i })))
          onRefresh?.()
        } catch (error) {
          console.error("Failed to reorder groups:", error)
        }
      }
      return
    }

    // Handle interface reordering/moving
    if (activeId.startsWith("page-")) {
      const pageId = activeId.replace("page-", "")
      let targetGroupId: string | null = null

      if (overId.startsWith("group-")) {
        targetGroupId = overId.replace("group-", "")
      } else if (overId.startsWith("page-")) {
        const targetPageId = overId.replace("page-", "")
        const targetPage = pages.find((p) => p.id === targetPageId)
        targetGroupId = targetPage?.group_id || null
      } else if (overId === "uncategorized") {
        targetGroupId = null
      }

      const activePage = pages.find((p) => p.id === pageId)
      if (!activePage) return

      // Get all pages in target group (excluding the active page)
      const targetPages = (targetGroupId
        ? pagesByGroup[targetGroupId] || []
        : uncategorizedPages).filter((p) => p.id !== pageId)

      // Find insertion index
      let insertIndex = targetPages.length
      if (overId.startsWith("page-")) {
        const targetPageId = overId.replace("page-", "")
        const targetIndex = targetPages.findIndex((p) => p.id === targetPageId)
        if (targetIndex !== -1) {
          insertIndex = targetIndex
        }
      }

      // Build updates: reorder all pages in target group
      const updates: Array<{ id: string; group_id: string | null; order_index: number }> = []
      
      // Update pages before insertion point
      for (let i = 0; i < insertIndex; i++) {
        updates.push({
          id: targetPages[i].id,
          group_id: targetGroupId,
          order_index: i,
        })
      }

      // Insert the moved page
      updates.push({
        id: pageId,
        group_id: targetGroupId,
        order_index: insertIndex,
      })

      // Update pages after insertion point
      for (let i = insertIndex; i < targetPages.length; i++) {
        updates.push({
          id: targetPages[i].id,
          group_id: targetGroupId,
          order_index: i + 1,
        })
      }

      // Update pages in old group (if different)
      if (activePage.group_id !== targetGroupId) {
        const oldGroupPages = (activePage.group_id
          ? pagesByGroup[activePage.group_id] || []
          : uncategorizedPages).filter((p) => p.id !== pageId)

        oldGroupPages.forEach((p, i) => {
          updates.push({
            id: p.id,
            group_id: activePage.group_id ?? null,
            order_index: i,
          })
        })
      }

      try {
        const response = await fetch("/api/interfaces/reorder", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ interfaceUpdates: updates }),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
          throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
        }

        const result = await response.json()
        if (!result.success) {
          throw new Error(result.error || 'Failed to reorder interfaces')
        }

        // Update local state optimistically
        setPages((prev) =>
          prev.map((p) => {
            const update = updates.find((u) => u.id === p.id)
            return update ? { ...p, group_id: update.group_id, order_index: update.order_index } : p
          })
        )
        onRefresh?.()
      } catch (error) {
        console.error("Failed to reorder interfaces:", error)
        // Show error to user (you might want to add a toast notification here)
        alert(`Failed to reorder interfaces: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }
  }

  // Sortable Group Component
  function SortableGroup({ group }: { group: InterfaceGroup }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
      id: `group-${group.id}`,
      disabled: !editMode,
    })
    const { setNodeRef: setDroppableRef, isOver } = useDroppable({
      id: `group-${group.id}`,
    })

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
    }

    const isCollapsed = collapsedGroups.has(group.id)
    const groupPages = pagesByGroup[group.id] || []

    // Combine refs for sortable and droppable
    const combinedRef = (node: HTMLDivElement | null) => {
      setNodeRef(node)
      setDroppableRef(node)
    }

    if (!editMode) {
      // Navigation mode - clean folder-style UI
      return (
        <div className="px-2 py-1">
          <button
            onClick={() => toggleGroup(group.id)}
            className="w-full flex items-center gap-2 px-2 py-1.5 text-sm font-medium hover:bg-gray-50 rounded transition-colors"
            style={{ color: sidebarTextColor }}
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" style={{ color: sidebarTextColor }} />
            ) : (
              <ChevronDown className="h-4 w-4" style={{ color: sidebarTextColor }} />
            )}
            <Folder className="h-4 w-4" style={{ color: sidebarTextColor }} />
            <span className="flex-1 text-left truncate">{group.name}</span>
          </button>
          {!isCollapsed && (
            <div className="ml-6 mt-0.5 space-y-0.5">
              {groupPages.map((page) => (
                <NavigationPage key={page.id} page={page} />
              ))}
            </div>
          )}
        </div>
      )
    }

    // Edit mode - full editing UI
    return (
      <div ref={combinedRef} style={style} className={`group ${isOver ? 'bg-blue-50' : ''}`}>
        <div className="flex items-center gap-1 px-2 py-1 hover:bg-gray-50 rounded">
          <button
            {...attributes}
            {...listeners}
            className="p-0.5 hover:bg-gray-200 rounded cursor-grab active:cursor-grabbing"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="h-3 w-3" style={{ color: sidebarTextColor }} />
          </button>
          <button
            onClick={() => toggleGroup(group.id)}
            className="flex-1 flex items-center gap-1 px-1 py-0.5 text-xs font-semibold uppercase tracking-wider hover:bg-gray-100 rounded"
            style={{ color: sidebarTextColor }}
          >
            {isCollapsed ? (
              <ChevronRight className="h-3 w-3" style={{ color: sidebarTextColor }} />
            ) : (
              <ChevronDown className="h-3 w-3" style={{ color: sidebarTextColor }} />
            )}
            {editingGroupId === group.id ? (
              <Input
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onBlur={() => handleSaveGroup(group.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleSaveGroup(group.id)
                  } else if (e.key === "Escape") {
                    setEditingGroupId(null)
                  }
                }}
                className="h-5 text-xs px-1 py-0"
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span className="truncate">{group.name}</span>
            )}
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <button className="p-0.5 hover:bg-gray-200 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                <Edit2 className="h-3 w-3" style={{ color: sidebarTextColor }} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleStartEditGroup(group)}>
                Rename
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => handleDeleteGroup(group.id)}
                className="text-red-600"
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {!isCollapsed && (
          <div className="ml-4 space-y-0.5 mt-0.5">
            {groupPages.map((page) => (
              <SortablePage key={page.id} page={page} />
            ))}
          </div>
        )}
      </div>
    )
  }

  // Navigation Page Component (view mode)
  function NavigationPage({ page }: { page: InterfacePage }) {
    const isActive = pathname.includes(`/pages/${page.id}`)

    return (
      <Link
        href={`/pages/${page.id}`}
        className="flex items-center gap-2 px-2 py-1.5 rounded transition-colors hover:bg-gray-50"
        onClick={(e) => {
          // Only navigate, don't toggle edit mode
          e.stopPropagation()
        }}
        style={isActive ? { 
          backgroundColor: primaryColor + '10', 
          color: primaryColor 
        } : { color: sidebarTextColor }}
      >
        <Layers className="h-4 w-4 flex-shrink-0" style={{ color: isActive ? primaryColor : sidebarTextColor }} />
        <span className="text-sm truncate">{page.name}</span>
      </Link>
    )
  }

  // Uncategorized Droppable Component
  function UncategorizedDroppable({ children }: { children: React.ReactNode }) {
    const { setNodeRef, isOver } = useDroppable({
      id: "uncategorized",
    })

    return (
      <div 
        ref={setNodeRef} 
        className="rounded"
        style={isOver ? { backgroundColor: primaryColor + '15' } : {}}
      >
        {children}
      </div>
    )
  }

  // Sortable Page Component (edit mode)
  function SortablePage({ page }: { page: InterfacePage }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
      id: `page-${page.id}`,
      disabled: !editMode,
    })

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
    }

    const isActive = pathname.includes(`/pages/${page.id}`)

    return (
      <div ref={setNodeRef} style={style} className="group/page">
        <div className="flex items-center gap-1">
          <button
            {...attributes}
            {...listeners}
            className="p-0.5 hover:bg-gray-200 rounded cursor-grab active:cursor-grabbing opacity-0 group-hover/page:opacity-100 transition-opacity"
            onClick={(e) => e.preventDefault()}
          >
            <GripVertical className="h-3 w-3" style={{ color: sidebarTextColor }} />
          </button>
          {editingPageId === page.id ? (
            <Input
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
              onBlur={() => handleSavePage(page.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSavePage(page.id)
                } else if (e.key === "Escape") {
                  setEditingPageId(null)
                }
              }}
              className="flex-1 h-7 text-sm px-2 py-0"
              autoFocus
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <Link
              href={`/pages/${page.id}`}
              className="flex-1 flex items-center gap-2 px-2 py-1.5 rounded transition-colors hover:bg-gray-100"
              style={isActive ? { 
                backgroundColor: primaryColor + '15', 
                color: primaryColor 
              } : { color: sidebarTextColor }}
            >
              <Layers className="h-4 w-4 flex-shrink-0" style={{ color: isActive ? primaryColor : sidebarTextColor }} />
              <span className="text-sm truncate">{page.name}</span>
            </Link>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <button className="p-0.5 hover:bg-gray-200 rounded opacity-0 group-hover/page:opacity-100 transition-opacity">
                <Edit2 className="h-3 w-3" style={{ color: sidebarTextColor }} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleStartEditPage(page)}>
                Rename
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => handleDeletePage(page.id)}
                className="text-red-600 focus:text-red-600"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    )
  }

  const allSortableIds = [
    ...sortedGroups.map((g) => `group-${g.id}`),
    ...pages.map((p) => `page-${p.id}`),
    "uncategorized",
  ]

  // Render based on mode
  if (!editMode) {
    // Browse mode - clean navigation UI
    // If no groups exist but pages do, show pages directly
    if (sortedGroups.length === 0 && pages.length > 0) {
      return (
        <div className="space-y-1">
          {pages.map((page) => (
            <NavigationPage key={page.id} page={page} />
          ))}
        </div>
      )
    }
    
    return (
      <div className="space-y-1">
        {sortedGroups.map((group) => {
          const isCollapsed = collapsedGroups.has(group.id)
          const groupPages = pagesByGroup[group.id] || []
          
          // Skip empty groups in Browse mode
          if (groupPages.length === 0) return null
          
          return (
            <div key={group.id} className="px-2 py-1">
              <button
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  toggleGroup(group.id)
                }}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-sm font-medium hover:bg-gray-50 rounded transition-colors"
                style={{ color: sidebarTextColor }}
              >
                {isCollapsed ? (
                  <ChevronRight className="h-4 w-4 flex-shrink-0" style={{ color: sidebarTextColor }} />
                ) : (
                  <ChevronDown className="h-4 w-4 flex-shrink-0" style={{ color: sidebarTextColor }} />
                )}
                <Folder className="h-4 w-4 flex-shrink-0" style={{ color: sidebarTextColor }} />
                <span className="flex-1 text-left truncate">{group.name}</span>
              </button>
              {!isCollapsed && (
                <div className="ml-6 mt-0.5 space-y-0.5">
                  {groupPages.map((page) => (
                    <NavigationPage key={page.id} page={page} />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  // Edit mode - full editing UI
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-1">
        <div className="px-2 mb-1 flex gap-1">
          <button
            onClick={() => setNewPageModalOpen(true)}
            className="flex-1 flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-gray-100 rounded transition-colors"
            style={{ color: sidebarTextColor }}
          >
            <Plus className="h-4 w-4" style={{ color: sidebarTextColor }} />
            <span>New Page</span>
          </button>
          <button
            onClick={handleCreateGroup}
            className="flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-gray-100 rounded transition-colors"
            style={{ color: sidebarTextColor }}
            title="New Interface"
          >
            <Plus className="h-4 w-4" style={{ color: sidebarTextColor }} />
            <span className="hidden sm:inline">Interface</span>
          </button>
        </div>

        <SortableContext items={allSortableIds} strategy={verticalListSortingStrategy}>
          {sortedGroups.map((group) => (
            <SortableGroup key={group.id} group={group} />
          ))}
          {/* Render uncategorized pages if any exist */}
          {uncategorizedPages.length > 0 && (
            <UncategorizedDroppable>
              <div className="px-2 py-1">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 px-2">
                  Ungrouped
                </div>
                <div className="ml-4 space-y-0.5">
                  {uncategorizedPages.map((page) => (
                    <SortablePage key={page.id} page={page} />
                  ))}
                </div>
              </div>
            </UncategorizedDroppable>
          )}
        </SortableContext>
      </div>

      <DragOverlay>
        {activeId ? (
          <div className="bg-white border border-gray-200 rounded shadow-lg p-2">
            {activeId.startsWith("group-") ? (
              <span className="text-xs font-semibold uppercase" style={{ color: sidebarTextColor }}>
                {groups.find((g) => `group-${g.id}` === activeId)?.name}
              </span>
            ) : (
              <span className="text-sm" style={{ color: sidebarTextColor }}>
                {pages.find((p) => `page-${p.id}` === activeId)?.name}
              </span>
            )}
          </div>
        ) : null}
      </DragOverlay>

      <PageCreationWizard
        open={newPageModalOpen}
        onOpenChange={(open) => {
          setNewPageModalOpen(open)
          if (!open) {
            setSelectedGroupId(null)
          }
        }}
        defaultGroupId={selectedGroupId}
      />
    </DndContext>
  )
}
