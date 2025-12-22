"use client"

import { useState, useEffect, useCallback } from "react"
import { Save, Eye, Edit2, Plus, Trash2, Settings } from "lucide-react"
import Canvas from "./Canvas"
import FloatingBlockPicker from "./FloatingBlockPicker"
import SettingsPanel from "./SettingsPanel"
import PageSettingsDrawer from "./PageSettingsDrawer"
import type { PageBlock, LayoutItem, Page } from "@/lib/interface/types"
import { BLOCK_REGISTRY } from "@/lib/interface/registry"
import type { BlockType } from "@/lib/interface/types"

interface InterfaceBuilderProps {
  page: Page
  initialBlocks: PageBlock[]
  isViewer?: boolean
  onSave?: () => void
}

export default function InterfaceBuilder({
  page,
  initialBlocks,
  isViewer = false,
  onSave,
}: InterfaceBuilderProps) {
  const [blocks, setBlocks] = useState<PageBlock[]>(initialBlocks)
  
  // Default to view mode - editing is explicit and intentional
  // Persist edit mode preference in localStorage per page
  const [isEditing, setIsEditing] = useState(() => {
    if (typeof window === 'undefined') return false
    if (isViewer) return false // Force view mode if viewer prop is set
    const saved = localStorage.getItem(`interface-edit-mode-${page.id}`)
    return saved === 'true'
  })
  
  // Sync edit mode to localStorage when it changes
  useEffect(() => {
    if (typeof window !== 'undefined' && !isViewer) {
      localStorage.setItem(`interface-edit-mode-${page.id}`, String(isEditing))
    }
  }, [isEditing, page.id, isViewer])
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [pageSettingsOpen, setPageSettingsOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState<Page>(page)

  const handleLayoutChange = useCallback(
    async (layout: LayoutItem[]) => {
      // Auto-save layout changes
      try {
        const response = await fetch(`/api/pages/${page.id}/blocks`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ layout }),
        })

        if (response.ok) {
          // Update local state to reflect saved positions
          setBlocks((prevBlocks) => {
            return prevBlocks.map((block) => {
              const layoutItem = layout.find((item) => item.i === block.id)
              if (layoutItem) {
                return {
                  ...block,
                  x: layoutItem.x,
                  y: layoutItem.y,
                  w: layoutItem.w,
                  h: layoutItem.h,
                }
              }
              return block
            })
          })
        }
      } catch (error) {
        console.error("Failed to save layout:", error)
      }
    },
    [page.id]
  )

  const handleBlockUpdate = useCallback(
    async (blockId: string, config: Partial<PageBlock["config"]>) => {
      try {
        await fetch(`/api/pages/${page.id}/blocks`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            blockUpdates: [{ id: blockId, config }],
          }),
        })

        // Update local state
        setBlocks((prev) =>
          prev.map((b) => (b.id === blockId ? { ...b, config: { ...b.config, ...config } } : b))
        )
      } catch (error) {
        console.error("Failed to update block:", error)
      }
    },
    [page.id]
  )

  const handleAddBlock = useCallback(
    async (type: BlockType) => {
      const def = BLOCK_REGISTRY[type]
      const maxY = blocks.length > 0 ? Math.max(...blocks.map((b) => b.y + b.h)) : 0

      try {
        const response = await fetch(`/api/pages/${page.id}/blocks`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type,
            x: 0,
            y: maxY,
            w: def.defaultWidth,
            h: def.defaultHeight,
            config: def.defaultConfig,
          }),
        })

        const { block } = await response.json()
        setBlocks((prev) => [...prev, block])
        setSelectedBlockId(block.id)
      } catch (error) {
        console.error("Failed to create block:", error)
      }
    },
    [page.id, blocks]
  )

  const handleDeleteBlock = useCallback(
    async (blockId: string) => {
      if (!confirm("Are you sure you want to delete this block?")) return

      try {
        await fetch(`/api/pages/${page.id}/blocks/${blockId}`, {
          method: "DELETE",
        })

        setBlocks((prev) => prev.filter((b) => b.id !== blockId))
        if (selectedBlockId === blockId) {
          setSelectedBlockId(null)
        }
      } catch (error) {
        console.error("Failed to delete block:", error)
      }
    },
    [page.id, selectedBlockId]
  )

  const handleSaveSettings = useCallback(
    async (blockId: string, config: Partial<PageBlock["config"]>) => {
      await handleBlockUpdate(blockId, config)
    },
    [handleBlockUpdate]
  )

  const handlePageUpdate = useCallback(async () => {
    // Reload page data
    try {
      const response = await fetch(`/api/pages/${page.id}`)
      if (response.ok) {
        const data = await response.json()
        setCurrentPage(data.page)
      }
    } catch (error) {
      console.error("Failed to reload page:", error)
    }
  }, [page.id])

  const selectedBlock = blocks.find((b) => b.id === selectedBlockId) || null

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Main Canvas - Full width when not editing */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold">{currentPage.name}</h1>
            {currentPage.description && (
              <span className="text-sm text-gray-500">— {currentPage.description}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPageSettingsOpen(true)}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 flex items-center gap-2"
              title="Interface Settings"
            >
              <Settings className="h-4 w-4" />
            </button>
            {isEditing ? (
              <>
                {selectedBlock && (
                  <div className="px-3 py-1.5 text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-md">
                    Selected: {selectedBlock.type} block
                  </div>
                )}
                {selectedBlockId && (
                  <button
                    onClick={() => handleDeleteBlock(selectedBlockId)}
                    className="px-3 py-1.5 text-sm font-medium text-red-600 bg-white border border-red-300 rounded-md hover:bg-red-50 flex items-center gap-2"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </button>
                )}
                <button
                  onClick={() => {
                    setIsEditing(false)
                    setSelectedBlockId(null)
                  }}
                  className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md flex items-center gap-2"
                >
                  Done
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 flex items-center gap-2"
              >
                <Edit2 className="h-4 w-4" />
                Edit interface
              </button>
            )}
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 overflow-auto p-4">
          <Canvas
            blocks={blocks}
            isEditing={isEditing}
            onLayoutChange={handleLayoutChange}
            onBlockUpdate={handleBlockUpdate}
            onBlockClick={setSelectedBlockId}
            onBlockDelete={handleDeleteBlock}
            selectedBlockId={selectedBlockId}
            layoutSettings={page.settings?.layout}
          />
        </div>
      </div>

      {/* Settings Panel */}
      {isEditing && (
        <SettingsPanel
          block={selectedBlock}
          isOpen={!!selectedBlock}
          onClose={() => setSelectedBlockId(null)}
          onSave={handleSaveSettings}
        />
      )}

      {/* Floating Block Picker - Only visible in edit mode */}
      {isEditing && (
        <FloatingBlockPicker onSelectBlock={handleAddBlock} />
      )}

      {/* Page Settings Drawer */}
      <PageSettingsDrawer
        page={currentPage}
        open={pageSettingsOpen}
        onOpenChange={setPageSettingsOpen}
        onPageUpdate={handlePageUpdate}
      />
    </div>
  )
}
