"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
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
import NewPageModal from "@/components/interface/NewPageModal"

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

interface GroupedInterfacesProps {
  interfacePages: InterfacePage[]
  interfaceGroups: InterfaceGroup[]
  onRefresh?: () => void
}

export default function GroupedInterfaces({
  interfacePages,
  interfaceGroups: initialGroups,
  onRefresh,
}: GroupedInterfacesProps) {
  const pathname = usePathname()
  const [groups, setGroups] = useState<InterfaceGroup[]>(initialGroups)
  const [pages, setPages] = useState<InterfacePage[]>(interfacePages)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
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
  const pagesByGroup = pages.reduce((acc, page) => {
    const groupId = page.group_id || "uncategorized"
    if (!acc[groupId]) {
      acc[groupId] = []
    }
    acc[groupId].push(page)
    return acc
  }, {} as Record<string, InterfacePage[]>)

  // Sort pages within each group by order_index
  Object.keys(pagesByGroup).forEach((groupId) => {
    pagesByGroup[groupId].sort((a, b) => (a.order_index || 0) - (b.order_index || 0))
  })

  // Get uncategorized pages
  const uncategorizedPages = pagesByGroup["uncategorized"] || []

  // Sort groups by order_index
  const sortedGroups = [...groups].sort((a, b) => a.order_index - b.order_index)

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
      }
    } catch (error) {
      console.error("Failed to update group:", error)
    }
  }

  const handleDeleteGroup = async (groupId: string) => {
    if (!confirm("Delete this group? Interfaces will be moved to Uncategorized.")) {
      return
    }

    try {
      const response = await fetch(`/api/interface-groups/${groupId}`, {
        method: "DELETE",
      })

      if (response.ok) {
        setGroups((prev) => prev.filter((g) => g.id !== groupId))
        setPages((prev) => prev.map((p) => (p.group_id === groupId ? { ...p, group_id: null } : p)))
        onRefresh?.()
      }
    } catch (error) {
      console.error("Failed to delete group:", error)
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
        setGroups((prev) => [...prev, group])
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
      }
    } catch (error) {
      console.error("Failed to create group:", error)
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
            group_id: activePage.group_id,
            order_index: i,
          })
        })
      }

      try {
        await fetch("/api/interfaces/reorder", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ interfaceUpdates: updates }),
        })

        setPages((prev) =>
          prev.map((p) => {
            const update = updates.find((u) => u.id === p.id)
            return update ? { ...p, group_id: update.group_id, order_index: update.order_index } : p
          })
        )
        onRefresh?.()
      } catch (error) {
        console.error("Failed to reorder interfaces:", error)
      }
    }
  }

  // Sortable Group Component
  function SortableGroup({ group }: { group: InterfaceGroup }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
      id: `group-${group.id}`,
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

    return (
      <div ref={combinedRef} style={style} className={`group ${isOver ? 'bg-blue-50' : ''}`}>
        <div className="flex items-center gap-1 px-2 py-1 hover:bg-gray-50 rounded">
          <button
            {...attributes}
            {...listeners}
            className="p-0.5 hover:bg-gray-200 rounded cursor-grab active:cursor-grabbing"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="h-3 w-3 text-gray-400" />
          </button>
          <button
            onClick={() => toggleGroup(group.id)}
            className="flex-1 flex items-center gap-1 px-1 py-0.5 text-xs font-semibold text-gray-700 uppercase tracking-wider hover:bg-gray-100 rounded"
          >
            {isCollapsed ? (
              <ChevronRight className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
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
                <Edit2 className="h-3 w-3 text-gray-400" />
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

  // Uncategorized Droppable Component
  function UncategorizedDroppable({ children }: { children: React.ReactNode }) {
    const { setNodeRef, isOver } = useDroppable({
      id: "uncategorized",
    })

    return (
      <div ref={setNodeRef} className={isOver ? 'bg-blue-50 rounded' : ''}>
        {children}
      </div>
    )
  }

  // Sortable Page Component
  function SortablePage({ page }: { page: InterfacePage }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
      id: `page-${page.id}`,
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
            <GripVertical className="h-3 w-3 text-gray-400" />
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
              className={`flex-1 flex items-center gap-2 px-2 py-1.5 rounded transition-colors ${
                isActive
                  ? "bg-blue-50 text-blue-700"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              <Layers className="h-4 w-4 flex-shrink-0" />
              <span className="text-sm truncate">{page.name}</span>
            </Link>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <button className="p-0.5 hover:bg-gray-200 rounded opacity-0 group-hover/page:opacity-100 transition-opacity">
                <Edit2 className="h-3 w-3 text-gray-400" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleStartEditPage(page)}>
                Rename
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
            className="flex-1 flex items-center gap-2 px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>New Interface</span>
          </button>
          <button
            onClick={handleCreateGroup}
            className="flex items-center gap-2 px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded transition-colors"
            title="New Group"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Group</span>
          </button>
        </div>

        <SortableContext items={allSortableIds} strategy={verticalListSortingStrategy}>
          {sortedGroups.map((group) => (
            <SortableGroup key={group.id} group={group} />
          ))}

          {/* Uncategorized Section - Always visible for dropping */}
          <UncategorizedDroppable>
            <div className="group">
              <div className="flex items-center gap-1 px-2 py-1">
                <span className="flex-1 px-1 py-0.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Uncategorized
                </span>
              </div>
              {uncategorizedPages.length > 0 && (
                <div className="ml-4 space-y-0.5 mt-0.5">
                  {uncategorizedPages.map((page) => (
                    <SortablePage key={page.id} page={page} />
                  ))}
                </div>
              )}
            </div>
          </UncategorizedDroppable>
        </SortableContext>
      </div>

      <DragOverlay>
        {activeId ? (
          <div className="bg-white border border-gray-200 rounded shadow-lg p-2">
            {activeId.startsWith("group-") ? (
              <span className="text-xs font-semibold text-gray-700 uppercase">
                {groups.find((g) => `group-${g.id}` === activeId)?.name}
              </span>
            ) : (
              <span className="text-sm text-gray-700">
                {pages.find((p) => `page-${p.id}` === activeId)?.name}
              </span>
            )}
          </div>
        ) : null}
      </DragOverlay>

      <NewPageModal
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
