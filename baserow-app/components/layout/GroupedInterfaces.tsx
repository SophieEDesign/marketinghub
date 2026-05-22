"use client"

import { useState, useEffect, useCallback, useMemo, useRef, type CSSProperties } from "react"
import { usePathname, useRouter } from "next/navigation"
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
  DragCancelEvent,
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
import { renderIconByName } from "@/components/ui/lucide-icon-picker"
import { createClient } from "@/lib/supabase/client"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { sidebarNavItemClassName } from "@/components/shell/SidebarNavItem"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import PageCreationWizard from "@/components/interface/PageCreationWizard"
import { useToast } from "@/components/ui/use-toast"

interface InterfacePage {
  id: string
  name: string
  description?: string
  group_id?: string | null
  order_index?: number
  is_hidden?: boolean
}

interface InterfaceGroup {
  id: string
  name: string
  order_index: number
  collapsed: boolean
  workspace_id?: string | null
  is_system?: boolean
  icon?: string | null
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
  const router = useRouter()
  // Single source of truth: derive from pathname only (no params/searchParams mix)
  const currentPageId = pathname?.match(/\/pages\/([^/?]+)/)?.[1] ?? undefined
  const { primaryColor, sidebarTextColor } = useBranding()
  const { toast } = useToast()
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
  
  // Track interaction states - these are mutually exclusive
  const [isDragging, setIsDragging] = useState(false)
  const [isRenaming, setIsRenaming] = useState(false)
  
  // CRITICAL: Use ref for synchronous dragging check to prevent navigation blocking
  // State updates are async, but refs are synchronous - prevents stuck navigation
  const isDraggingRef = useRef(false)
  
  // Store original order for revert on error
  const [originalGroups, setOriginalGroups] = useState<InterfaceGroup[]>([])
  const [originalPages, setOriginalPages] = useState<InterfacePage[]>([])

  // Configure sensors to require explicit drag handle activation
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px movement before drag starts
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Sync props to state, but only when not dragging or editing
  useEffect(() => {
    if (!isDragging && !isRenaming) {
      setGroups(initialGroups.filter(g => g && g.id))
      setPages(interfacePages)
    }
  }, [initialGroups, interfacePages, isDragging, isRenaming])

  // Load collapse state from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("interface-groups-collapsed")
    if (saved) {
      try {
        const collapsed = JSON.parse(saved)
        setCollapsedGroups(new Set(collapsed))
      } catch {
        // Ignore parse errors and use default collapsed state below
        const defaultCollapsed = new Set(initialGroups.filter((g) => g && g.id).map((g) => g.id))
        setCollapsedGroups(defaultCollapsed)
        localStorage.setItem(
          "interface-groups-collapsed",
          JSON.stringify(Array.from(defaultCollapsed))
        )
      }
    } else {
      // Default behavior: keep groups closed until user explicitly opens them.
      const defaultCollapsed = new Set(initialGroups.filter((g) => g && g.id).map((g) => g.id))
      setCollapsedGroups(defaultCollapsed)
      localStorage.setItem("interface-groups-collapsed", JSON.stringify(Array.from(defaultCollapsed)))
    }
  }, [initialGroups])

  // Save collapse state to localStorage
  const saveCollapseState = useCallback((collapsed: Set<string>) => {
    localStorage.setItem("interface-groups-collapsed", JSON.stringify(Array.from(collapsed)))
  }, [])

  function browseGroupLabel(group: InterfaceGroup): string {
    if (group.id === "ungrouped-system-virtual") return "Other"
    if (group.is_system === true && group.name === "Ungrouped") return "Other"
    if (group.name === "Ungrouped" && group.id === ungroupedGroupId) return "Other"
    return group.name
  }

  // Keep the folder open for the group that contains the current page (browse mode)
  useEffect(() => {
    if (editMode || !currentPageId) return
    const page = pages.find((p) => p.id === currentPageId)
    if (!page) return
    const gid = page.group_id || ungroupedGroupId || "ungrouped-system-virtual"
    setCollapsedGroups((prev) => {
      if (!prev.has(gid)) return prev
      const next = new Set(prev)
      next.delete(gid)
      saveCollapseState(next)
      return next
    })
  }, [currentPageId, editMode, pages, ungroupedGroupId, saveCollapseState])

  // Organize pages by group
  // Pages without group_id go to "Ungrouped" system group
  const pagesForDisplay = useMemo(
    () => (editMode ? pages : pages.filter((page) => !page.is_hidden)),
    [editMode, pages]
  )

  const pagesByGroup = useMemo(() => {
    const result: Record<string, InterfacePage[]> = {}
    
    pagesForDisplay.forEach(page => {
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
  }, [pagesForDisplay, ungroupedGroupId])

  // Get uncategorized/ungrouped pages - use ungroupedGroupId as key (never "uncategorized")
  const uncategorizedPages = pagesByGroup[ungroupedGroupId] || []

  // Filter groups based on mode
  // In Browse mode, hide any group that has no visible pages
  // In Edit mode, show all groups so hidden/empty structure can still be managed
  const visibleGroups = useMemo(() => {
    if (editMode) {
      return allGroups
    }

    return allGroups.filter((g) => (pagesByGroup[g.id] || []).length > 0)
  }, [editMode, allGroups, pagesByGroup])

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
    // Prevent editing if dragging
    if (isDragging) return
    setIsRenaming(true)
    setEditingGroupId(group.id)
    setEditingName(group.name)
  }

  const handleCancelEditGroup = () => {
    const group = groups.find(g => g.id === editingGroupId)
    if (group) {
      setEditingName(group.name) // Restore original name
    }
    setEditingGroupId(null)
    setIsRenaming(false)
  }

  const handleSaveGroup = async (groupId: string, opts?: { trigger?: 'blur' | 'enter' | 'unknown' }) => {
    if (!editingName.trim()) {
      setEditingGroupId(null)
      setIsRenaming(false)
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
        setIsRenaming(false)
        window.dispatchEvent(new CustomEvent("pages-updated"))
        if (opts?.trigger === 'blur') {
          toast({
            title: "Finished editing",
            description: "Saved.",
          })
        }
        onRefresh?.()
      } else {
        console.warn("Failed to update group:", response.status, response.statusText)
        // Revert name on error
        setEditingGroupId(null)
        setIsRenaming(false)
      }
    } catch (error) {
      console.warn("Failed to update group:", error)
      // Revert on error
      setEditingGroupId(null)
      setIsRenaming(false)
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
    // Prevent editing if dragging
    if (isDragging) return
    setIsRenaming(true)
    setEditingPageId(page.id)
    setEditingName(page.name)
  }

  const handleCancelEditPage = () => {
    const page = pages.find(p => p.id === editingPageId)
    if (page) {
      setEditingName(page.name) // Restore original name
    }
    setEditingPageId(null)
    setIsRenaming(false)
  }

  const handleSavePage = async (pageId: string, opts?: { trigger?: 'blur' | 'enter' | 'unknown' }) => {
    if (!editingName.trim()) {
      setEditingPageId(null)
      setIsRenaming(false)
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
        setIsRenaming(false)
        window.dispatchEvent(new CustomEvent("pages-updated"))
        if (opts?.trigger === 'blur') {
          toast({
            title: "Finished editing",
            description: "Saved.",
          })
        }
        onRefresh?.()
      } else {
        // Revert on error
        setEditingPageId(null)
        setIsRenaming(false)
      }
    } catch (error) {
      console.error("Failed to update interface:", error)
      // Revert on error
      setEditingPageId(null)
      setIsRenaming(false)
    }
  }

  const handleTogglePageHidden = async (page: InterfacePage) => {
    try {
      const nextHidden = !Boolean(page.is_hidden)
      const response = await fetch(`/api/pages/${page.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_hidden: nextHidden }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Failed to update page visibility" }))
        throw new Error(errorData.error || "Failed to update page visibility")
      }

      setPages((prev) => prev.map((p) => (p.id === page.id ? { ...p, is_hidden: nextHidden } : p)))
      window.dispatchEvent(new CustomEvent("pages-updated"))
      onRefresh?.()
    } catch (error) {
      console.error("Failed to toggle page visibility:", error)
      alert(error instanceof Error ? error.message : "Failed to update page visibility.")
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
      toast({ title: "Moved to trash", description: "Page has been moved to trash." })
      
      // If we're on the deleted page, redirect to home (Phase 4: avoid full-page reload)
      if (currentPageId === pageId) {
        router.push('/')
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
    // Prevent drag if renaming
    if (isRenaming) {
      // Return early to prevent drag - DragStartEvent doesn't have preventDefault
      return
    }
    
    // Store original state for potential revert
    setOriginalGroups([...sortedGroups])
    setOriginalPages([...pages])
    
    // CRITICAL: Update both state and ref synchronously
    isDraggingRef.current = true
    setIsDragging(true)
    setActiveId(event.active.id as string)
  }

  const handleDragCancel = (_event: DragCancelEvent) => {
    // Drag can be cancelled (escape key, pointer cancel, route change, etc).
    // If we don't clear this state, the sidebar can become "unclickable"
    // due to `pointer-events-none` being left on items.
    // CRITICAL: Clear ref FIRST (synchronous) before state update (async)
    isDraggingRef.current = false
    setIsDragging(false)
    setActiveId(null)

    // Best-effort revert to original order.
    if (originalGroups.length > 0) setGroups(originalGroups)
    if (originalPages.length > 0) setPages(originalPages)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    
    // Always clear dragging state - CRITICAL: Clear ref FIRST (synchronous)
    isDraggingRef.current = false
    setIsDragging(false)
    setActiveId(null)

    if (!over) {
      // No drop target - revert to original state
      if (originalGroups.length > 0) setGroups(originalGroups)
      if (originalPages.length > 0) setPages(originalPages)
      return
    }

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
          const response = await fetch("/api/interface-groups/reorder", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ groupIds }),
          })

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
          }

          // Only update state after successful API call
          setGroups(newGroups.map((g, i) => ({ ...g, order_index: i })))
          onRefresh?.()
        } catch (error) {
          console.error("Failed to reorder groups:", error)
          // Revert to original state on error
          if (originalGroups.length > 0) setGroups(originalGroups)
          alert(`Failed to reorder interfaces: ${error instanceof Error ? error.message : 'Unknown error'}`)
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

        // Only update state after successful API call (no optimistic updates)
        setPages((prev) =>
          prev.map((p) => {
            const update = updates.find((u) => u.id === p.id)
            return update ? { ...p, group_id: update.group_id, order_index: update.order_index } : p
          })
        )
        onRefresh?.()
      } catch (error) {
        console.error("Failed to reorder interfaces:", error)
        // Revert to original state on error
        if (originalPages.length > 0) setPages(originalPages)
        alert(`Failed to reorder interfaces: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }
  }

  // Safety: never let the sidebar remain in "dragging" mode across navigation.
  // CRITICAL: Clear ref FIRST (synchronous) so navigation isn't blocked
  useEffect(() => {
    // Always clear on navigation - don't check current state (might be stale)
    isDraggingRef.current = false
    setIsDragging(false)
    setActiveId(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  // Sortable Group Component
  function SortableGroup({ group }: { group: InterfaceGroup }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
      id: `group-${group.id}`,
      disabled: !editMode || isRenaming || editingGroupId !== null,
    })
    const { setNodeRef: setDroppableRef, isOver } = useDroppable({
      id: `group-${group.id}`,
    })

    const style = {
      transform: CSS.Transform.toString(transform),
      transition: isDragging ? 'none' : transition, // No transition during drag for stability
      opacity: isDragging ? 0.3 : 1,
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
            className="w-full flex items-center gap-2 px-2 py-1.5 text-sm font-medium hover:bg-black/10 rounded transition-colors"
            style={{ color: sidebarTextColor }}
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" style={{ color: sidebarTextColor }} />
            ) : (
              <ChevronDown className="h-4 w-4" style={{ color: sidebarTextColor }} />
            )}
            {group.icon ? (
              <span style={{ color: sidebarTextColor }}>
                {renderIconByName(group.icon, "h-4 w-4")}
              </span>
            ) : (
              <Folder className="h-4 w-4" style={{ color: sidebarTextColor }} />
            )}
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
    const isEditing = editingGroupId === group.id
    const canDrag = editMode && !isRenaming && !isEditing
    
    return (
      <div 
        ref={combinedRef} 
        style={style} 
        className={`group ${isOver && canDrag ? 'bg-blue-50 border-l-2 border-blue-400' : ''} ${isDragging ? 'pointer-events-none' : ''}`}
      >
        <div className="flex items-center gap-1 px-2 py-1 hover:bg-black/10 rounded min-w-0">
          {canDrag ? (
            <button
              {...attributes}
              {...listeners}
              className="p-0.5 hover:bg-black/20 rounded cursor-grab active:cursor-grabbing flex-shrink-0"
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              title="Drag to reorder"
            >
              <GripVertical className="h-3 w-3" style={{ color: sidebarTextColor }} />
            </button>
          ) : (
            <div className="p-0.5 w-3 h-3 flex-shrink-0" />
          )}
          <button
            onClick={() => toggleGroup(group.id)}
            className="flex-1 flex items-center gap-1 px-1 py-0.5 text-xs font-semibold uppercase tracking-wider hover:bg-black/10 rounded min-w-0"
            style={{ color: sidebarTextColor }}
          >
            {isCollapsed ? (
              <ChevronRight className="h-3 w-3 flex-shrink-0" style={{ color: sidebarTextColor }} />
            ) : (
              <ChevronDown className="h-3 w-3 flex-shrink-0" style={{ color: sidebarTextColor }} />
            )}
            {group.icon ? (
              <span className="flex-shrink-0" style={{ color: sidebarTextColor }}>
                {renderIconByName(group.icon, "h-3 w-3")}
              </span>
            ) : (
              <Folder className="h-3 w-3 flex-shrink-0" style={{ color: sidebarTextColor }} />
            )}
            {editingGroupId === group.id ? (
              <Input
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onBlur={() => handleSaveGroup(group.id, { trigger: 'blur' })}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    handleSaveGroup(group.id, { trigger: 'enter' })
                  } else if (e.key === "Escape") {
                    e.preventDefault()
                    handleCancelEditGroup()
                  }
                }}
                className="h-5 text-xs px-1 py-0"
                autoFocus
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                draggable={false}
              />
            ) : (
              <span className="truncate min-w-0 flex-1 text-left">{group.name}</span>
            )}
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <button 
                className="p-0.5 hover:bg-black/20 rounded opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                disabled={isDragging || isRenaming}
                onMouseDown={(e) => e.stopPropagation()}
              >
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
  // Use full page navigation - Next.js client-side routing (Link/router.push) fails in this app
  function NavigationPage({ page, level = 0 }: { page: InterfacePage; level?: number }) {
    const targetPageId = page.id
    const targetPath = `/pages/${targetPageId}`
    const isActive = currentPageId === targetPageId

    const className = cn(
      sidebarNavItemClassName(isActive),
      level > 0 && "pl-6"
    )

    return (
      <a
        href={targetPath}
        className={className}
        onClick={(e) => {
          if (isActive) {
            e.preventDefault()
            router.refresh()
          }
          // Let default <a> navigation run for non-active - full page load, always works
        }}
      >
        <span className="truncate flex-1">{page.name}</span>
      </a>
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
    const isEditing = editingPageId === page.id
    const canDrag = editMode && !isRenaming && !isEditing
    
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
      id: `page-${page.id}`,
      disabled: !editMode || isRenaming || isEditing,
    })

    const style = {
      transform: CSS.Transform.toString(transform),
      transition: isDragging ? 'none' : transition, // No transition during drag for stability
      opacity: isDragging ? 0.3 : 1,
    }

    const targetPageId = page.id
    const isActive = currentPageId === targetPageId

    const isHidden = Boolean(page.is_hidden)

    return (
      <div 
        ref={setNodeRef} 
        style={style}
        className={cn(
          "group/page",
          isDragging ? "pointer-events-none" : "",
          isHidden && "opacity-60"
        )}
      >
        <div className="flex items-center gap-1 min-w-0">
          {canDrag ? (
            <button
              {...attributes}
              {...listeners}
              className="p-0.5 hover:bg-black/20 rounded cursor-grab active:cursor-grabbing opacity-0 group-hover/page:opacity-100 transition-opacity flex-shrink-0"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
              }}
              onMouseDown={(e) => e.stopPropagation()}
              title="Drag to reorder"
            >
              <GripVertical className="h-3 w-3" style={{ color: sidebarTextColor }} />
            </button>
          ) : (
            <div className="p-0.5 w-3 h-3 flex-shrink-0 opacity-0 group-hover/page:opacity-0" />
          )}
          {editingPageId === page.id ? (
            <Input
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
              onBlur={() => handleSavePage(page.id, { trigger: 'blur' })}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  handleSavePage(page.id, { trigger: 'enter' })
                } else if (e.key === "Escape") {
                  e.preventDefault()
                  handleCancelEditPage()
                }
              }}
              className="flex-1 min-w-0 h-7 text-sm px-2 py-0"
              autoFocus
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              draggable={false}
              onDragStart={(e) => e.preventDefault()}
            />
          ) : (
            <a
              href={`/pages/${targetPageId}`}
              className={cn(
                "flex-1 flex items-center gap-2 min-w-0 rounded-lg px-2 py-1.5 transition-colors",
                sidebarNavItemClassName(isActive)
              )}
              onClick={(e) => {
                if (editMode && isDraggingRef.current && activeId) {
                  e.preventDefault()
                  e.stopPropagation()
                  return
                }
                if (isActive) {
                  e.preventDefault()
                  router.refresh()
                }
                // Let default <a> navigation run for non-active - full page load
              }}
            >
              <Layers
                className={cn(
                  "h-4 w-4 flex-shrink-0",
                  isActive ? "text-foreground" : "text-muted-foreground"
                )}
              />
              <span className={cn("text-sm truncate min-w-0 flex-1", isHidden && "italic text-muted-foreground")}>
                {page.name}
                {isHidden ? " (Hidden)" : ""}
              </span>
            </a>
          )}
            <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <button 
                className="p-0.5 hover:bg-black/20 rounded opacity-0 group-hover/page:opacity-100 transition-opacity flex-shrink-0"
                disabled={isDragging || isRenaming}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <Edit2 className="h-3 w-3" style={{ color: sidebarTextColor }} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleStartEditPage(page)}>
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleTogglePageHidden(page)}>
                {isHidden ? "Show in sidebar" : "Hide from sidebar"}
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

  const browseShowFlatPages =
    sortedGroups.length === 1 &&
    Boolean(sortedGroups[0]?.is_system) &&
    (sortedGroups[0].name === "Ungrouped" ||
      sortedGroups[0].id === "ungrouped-system-virtual" ||
      sortedGroups[0].id === ungroupedGroupId)

  // Render based on mode
  if (!editMode) {
    // Browse mode - clean navigation UI
    // Flat list when there are no sections, or only the system ungrouped bucket
    if ((sortedGroups.length === 0 || browseShowFlatPages) && pagesForDisplay.length > 0) {
      return (
        <div className="flex flex-col gap-0.5 px-1">
          {pagesForDisplay.map((page) => (
            <NavigationPage key={page.id} page={page} level={0} />
          ))}
        </div>
      )
    }
    
    return (
      <div className="flex flex-col gap-0.5 px-1">
        {sortedGroups.map((group) => {
          const isCollapsed = collapsedGroups.has(group.id)
          const groupPages = pagesByGroup[group.id] || []
          
          return (
            <div key={group.id}>
              <button
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  toggleGroup(group.id)
                }}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors",
                  "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}
              >
                {group.icon ? (
                  <span className="text-muted-foreground">
                    {renderIconByName(group.icon, "h-4 w-4")}
                  </span>
                ) : (
                  <Folder className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                )}
                <span className="flex-1 text-left truncate text-sm font-semibold text-foreground">
                  {browseGroupLabel(group)}
                </span>
                {isCollapsed ? (
                  <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                )}
              </button>
              {!isCollapsed && (
                <div className="flex flex-col gap-0.5">
                  {groupPages.map((page) => (
                    <NavigationPage key={page.id} page={page} level={1} />
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
      onDragCancel={handleDragCancel}
    >
      <div className="space-y-1">
        <div className="px-2 mb-2 flex gap-1 flex-shrink-0">
          <button
            onClick={() => setNewPageModalOpen(true)}
            className="flex-1 flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-black/10 rounded transition-colors"
            style={{ color: sidebarTextColor }}
          >
            <Plus className="h-4 w-4" style={{ color: sidebarTextColor }} />
            <span>New Page</span>
          </button>
          <button
            onClick={handleCreateGroup}
            className="flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-black/10 rounded transition-colors"
            style={{ color: sidebarTextColor }}
            title="New section"
          >
            <Plus className="h-4 w-4" style={{ color: sidebarTextColor }} />
            <span className="hidden sm:inline">Section</span>
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
                  Other
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
        {activeId && isDragging ? (
          <div className="bg-white dark:bg-gray-800 border-2 border-blue-400 rounded shadow-xl p-2 opacity-95 text-gray-900 dark:text-gray-100">
            {activeId.startsWith("group-") ? (
              <div className="flex items-center gap-2">
                <GripVertical className="h-3 w-3 text-gray-600 dark:text-gray-400" />
                <span className="text-xs font-semibold uppercase">
                  {groups.find((g) => `group-${g.id}` === activeId)?.name}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <GripVertical className="h-3 w-3 text-gray-600 dark:text-gray-400" />
                <Layers className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                <span className="text-sm">
                  {pages.find((p) => `page-${p.id}` === activeId)?.name}
                </span>
              </div>
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
