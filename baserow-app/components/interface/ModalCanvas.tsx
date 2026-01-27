"use client"

import { useState, useEffect, useMemo } from "react"
import { Responsive, WidthProvider, Layout } from "react-grid-layout"
import "react-grid-layout/css/styles.css"
import "react-grid-layout/css/styles.css"
import BlockRenderer from "./BlockRenderer"
import BlockAppearanceWrapper from "./BlockAppearanceWrapper"
import { ErrorBoundary } from "./ErrorBoundary"
import type { PageBlock, LayoutItem } from "@/lib/interface/types"

const ResponsiveGridLayout = WidthProvider(Responsive)

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
}: ModalCanvasProps) {
  const [layout, setLayout] = useState<Layout[]>([])

  // Use provided layout settings or defaults (no gaps - blocks snap together)
  const layoutSettings = useMemo(() => ({
    cols: propLayoutSettings?.cols || 8,
    rowHeight: propLayoutSettings?.rowHeight || 30,
    margin: propLayoutSettings?.margin || [0, 0] as [number, number], // No gaps by default
  }), [propLayoutSettings])

  // Convert blocks to layout format
  useEffect(() => {
    if (blocks.length === 0) {
      setLayout([])
      return
    }

    const layoutItems: Layout[] = blocks.map((block) => ({
      i: block.id,
      x: block.x ?? 0,
      y: block.y ?? 0,
      w: block.w ?? 4,
      h: block.h ?? 4,
      minW: 2,
      minH: 2,
      maxW: 8,
      maxH: 20,
    }))

    setLayout(layoutItems)
  }, [blocks])

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

  return (
    <div className="w-full h-full">
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
        isDraggable={false}
        isResizable={false}
        measureBeforeMount={false}
      >
        {blocks.map((block) => (
          <div key={block.id} className="block-wrapper">
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
        ))}
      </ResponsiveGridLayout>
    </div>
  )
}
