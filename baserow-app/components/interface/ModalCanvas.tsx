"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { Responsive, WidthProvider, Layout } from "react-grid-layout"
import "react-grid-layout/css/styles.css"
import "react-grid-layout/css/styles.css"
import { GripVertical, Trash2, Plus } from "lucide-react"
import BlockRenderer from "./BlockRenderer"
import BlockAppearanceWrapper from "./BlockAppearanceWrapper"
import { ErrorBoundary } from "./ErrorBoundary"
import type { PageBlock } from "@/lib/interface/types"
import { MODAL_CANVAS_LAYOUT_DEFAULTS, MODAL_CANVAS_LAYOUT_CONSTRAINTS } from "@/lib/interface/canvas-layout-defaults"

const ResponsiveGridLayout = WidthProvider(Responsive)

export type ModalCanvasMode = "view" | "edit"

interface ModalCanvasProps {
  blocks: PageBlock[]
  tableId: string
  recordId: string | null
  tableName: string
  tableFields: any[]
  pageEditable?: boolean
  editableFieldNames?: string[]
  onFieldChange?: (fieldName: string, value: any) => void
  layoutSettings?: {
    cols?: number
    rowHeight?: number
    margin?: [number, number]
  }
  /** When "edit", shows drag handles, remove, add field; vertical reorder only. Requires onLayoutChange. */
  mode?: ModalCanvasMode
  /** Called when blocks are reordered or removed (edit mode). New array is normalized to single column. */
  onLayoutChange?: (blocks: PageBlock[]) => void
  /** Called when user clicks remove on a block (edit mode). */
  onRemoveBlock?: (blockId: string) => void
  /** Called when user clicks add field; insertAfterBlockId = null means append at end (edit mode). */
  onAddField?: (insertAfterBlockId: string | null) => void
}

export default function ModalCanvas({
  blocks,
  tableId,
  recordId,
  tableName,
  tableFields,
  pageEditable = false,
  editableFieldNames = [],
  onFieldChange,
  layoutSettings: propLayoutSettings,
  mode = "view",
  onLayoutChange,
  onRemoveBlock,
  onAddField,
}: ModalCanvasProps) {
  const [layout, setLayout] = useState<Layout[]>([])

  // Use provided layout settings or shared modal defaults (no gaps - blocks snap together)
  const layoutSettings = useMemo(() => ({
    cols: propLayoutSettings?.cols ?? MODAL_CANVAS_LAYOUT_DEFAULTS.cols,
    rowHeight: propLayoutSettings?.rowHeight ?? MODAL_CANVAS_LAYOUT_DEFAULTS.rowHeight,
    margin: (propLayoutSettings?.margin ?? MODAL_CANVAS_LAYOUT_DEFAULTS.margin) as [number, number],
  }), [propLayoutSettings])

  const cols = layoutSettings.cols

  // Convert blocks to layout format. In edit mode normalize to single column (x=0, w=full).
  useEffect(() => {
    if (blocks.length === 0) {
      setLayout([])
      return
    }

    const layoutItems: Layout[] = blocks.map((block, index) => ({
      i: block.id,
      x: mode === "edit" ? 0 : (block.x ?? 0),
      y: mode === "edit" ? index : (block.y ?? 0),
      w: mode === "edit" ? cols : (block.w ?? 4),
      h: block.h ?? 4,
      ...MODAL_CANVAS_LAYOUT_CONSTRAINTS,
    }))

    setLayout(layoutItems)
  }, [blocks, mode, cols])

  // Edit mode: handle layout change from drag — reorder blocks by y, normalize to single column, call onLayoutChange
  const handleLayoutChange = useCallback(
    (newLayout: Layout[]) => {
      if (mode !== "edit" || !onLayoutChange || newLayout.length === 0) return
      const sorted = [...newLayout].sort((a, b) => a.y - b.y)
      const reorderedBlocks: PageBlock[] = sorted.map((item, index) => {
        const block = blocks.find((b) => b.id === item.i)
        if (!block) return null
        return {
          ...block,
          x: 0,
          y: index,
          w: cols,
          h: block.h ?? 4,
        } as PageBlock
      }).filter((b): b is PageBlock => b != null)
      onLayoutChange(reorderedBlocks)
    },
    [mode, onLayoutChange, blocks, cols]
  )

  // Grid configuration for modal
  const GRID_CONFIG = useMemo(() => {
    return {
      cols: { lg: layoutSettings.cols, md: 6, sm: 4, xs: 2, xxs: 2 },
      rowHeight: layoutSettings.rowHeight,
      margin: layoutSettings.margin,
      compactType: null, // Disabled - use explicit coordinates
      isBounded: false,
      preventCollision: false,
      allowOverlap: false,
      containerPadding: [0, 0] as [number, number],
      useCSSTransforms: true,
    }
  }, [layoutSettings])

  if (blocks.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-gray-400 text-sm">
        <p>No fields configured in modal layout</p>
      </div>
    )
  }

  const isEditMode = mode === "edit"

  return (
    <div className="w-full h-full flex flex-col">
      <ResponsiveGridLayout
        className="layout"
        layouts={{ lg: layout }}
        breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
        cols={GRID_CONFIG.cols}
        rowHeight={GRID_CONFIG.rowHeight}
        margin={GRID_CONFIG.margin}
        compactType={GRID_CONFIG.compactType}
        isBounded={GRID_CONFIG.isBounded}
        preventCollision={GRID_CONFIG.preventCollision}
        allowOverlap={GRID_CONFIG.allowOverlap}
        containerPadding={GRID_CONFIG.containerPadding}
        useCSSTransforms={GRID_CONFIG.useCSSTransforms}
        isDraggable={isEditMode}
        isResizable={false}
        onLayoutChange={isEditMode ? handleLayoutChange : undefined}
        measureBeforeMount={false}
      >
        {blocks.map((block) => (
          <div key={block.id} className="block-wrapper">
            {isEditMode ? (
              <div className="flex items-stretch gap-0 border border-gray-200 rounded-md overflow-hidden bg-white">
                <div
                  className="flex items-center justify-center w-8 flex-shrink-0 bg-gray-50 border-r border-gray-200 cursor-grab active:cursor-grabbing touch-none"
                  title="Drag to reorder"
                >
                  <GripVertical className="h-4 w-4 text-gray-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <ErrorBoundary>
                    <BlockAppearanceWrapper block={block}>
                      <BlockRenderer
                        block={block}
                        isEditing={false}
                        pageTableId={tableId}
                        recordId={recordId}
                        pageEditable={pageEditable}
                        editableFieldNames={editableFieldNames}
                        mode="view"
                      />
                    </BlockAppearanceWrapper>
                  </ErrorBoundary>
                </div>
                {onRemoveBlock && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onRemoveBlock(block.id)
                    }}
                    className="flex items-center justify-center w-8 flex-shrink-0 bg-gray-50 border-l border-gray-200 hover:bg-red-50 text-gray-500 hover:text-red-600 transition-colors"
                    title="Remove"
                    aria-label="Remove"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ) : (
              <ErrorBoundary>
                <BlockAppearanceWrapper block={block}>
                  <BlockRenderer
                    block={block}
                    isEditing={false}
                    pageTableId={tableId}
                    recordId={recordId}
                    pageEditable={pageEditable}
                    editableFieldNames={editableFieldNames}
                    mode="view"
                  />
                </BlockAppearanceWrapper>
              </ErrorBoundary>
            )}
          </div>
        ))}
      </ResponsiveGridLayout>
      {isEditMode && onAddField && (
        <button
          type="button"
          onClick={() => onAddField(null)}
          className="mt-3 flex items-center justify-center gap-2 w-full py-2.5 border border-dashed border-gray-300 rounded-md text-gray-500 hover:border-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors text-sm"
        >
          <Plus className="h-4 w-4" />
          Add field
        </button>
      )}
    </div>
  )
}
