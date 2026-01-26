"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { Responsive, WidthProvider, Layout } from "react-grid-layout"
import "react-grid-layout/css/styles.css"
import "react-resizable/css/styles.css"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { X, Plus, Trash2 } from "lucide-react"
import type { BlockConfig } from "@/lib/interface/types"
import type { TableField } from "@/types/database"
import { getFieldDisplayName } from "@/lib/fields/display"
import BlockRenderer from "../BlockRenderer"
import BlockAppearanceWrapper from "../BlockAppearanceWrapper"
import { ErrorBoundary } from "../ErrorBoundary"

const ResponsiveGridLayout = WidthProvider(Responsive)

interface ModalLayoutBlock {
  id: string
  type: 'field' | 'text' | 'divider' | 'image'
  fieldName?: string
  x: number
  y: number
  w: number
  h: number
  config?: Record<string, any>
}

interface ModalLayoutEditorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  config: BlockConfig
  fields: TableField[]
  tableId: string
  onSave: (modalLayout: BlockConfig['modal_layout']) => void
}

export default function ModalLayoutEditor({
  open,
  onOpenChange,
  config,
  fields,
  tableId,
  onSave,
}: ModalLayoutEditorProps) {
  const [layoutBlocks, setLayoutBlocks] = useState<ModalLayoutBlock[]>([])
  const [layout, setLayout] = useState<Layout[]>([])
  const [addFieldValue, setAddFieldValue] = useState<string>("")

  // Load existing modal layout or initialize from modal_fields
  useEffect(() => {
    if (!open) return

    if (config.modal_layout?.blocks) {
      // Load from existing modal_layout
      setLayoutBlocks(config.modal_layout.blocks)
    } else if ((config as any).modal_fields && Array.isArray((config as any).modal_fields)) {
      // Initialize from modal_fields (backward compatibility)
      const modalFields = (config as any).modal_fields as string[]
      const initialBlocks: ModalLayoutBlock[] = modalFields.map((fieldName, index) => {
        const field = fields.find(f => f.name === fieldName || f.id === fieldName)
        if (!field) return null
        return {
          id: `field-${field.id}`,
          type: 'field',
          fieldName: field.name,
          x: index % 2 === 0 ? 0 : 4,
          y: Math.floor(index / 2),
          w: 4,
          h: 3,
          config: {
            field_id: field.id,
            field_name: field.name,
          },
        }
      }).filter((b): b is ModalLayoutBlock => b !== null)
      setLayoutBlocks(initialBlocks)
    } else {
      // Empty layout
      setLayoutBlocks([])
    }
  }, [open, config, fields])

  // Convert blocks to layout format
  useEffect(() => {
    const layoutItems: Layout[] = layoutBlocks.map((block) => ({
      i: block.id,
      x: block.x,
      y: block.y,
      w: block.w,
      h: block.h,
      minW: 2,
      minH: 2,
      maxW: 8,
      maxH: 10,
    }))
    setLayout(layoutItems)
  }, [layoutBlocks])

  // Available fields (not already in layout)
  const availableFields = useMemo(() => {
    const usedFieldNames = new Set(layoutBlocks.filter(b => b.type === 'field').map(b => b.fieldName))
    return fields.filter(f => f.name !== 'id' && !usedFieldNames.has(f.name))
  }, [fields, layoutBlocks])

  // Grid configuration
  const GRID_CONFIG = useMemo(() => ({
    cols: { lg: 8, md: 6, sm: 4, xs: 2, xxs: 2 },
    rowHeight: 30,
    margin: [8, 8] as [number, number],
    compactType: null as const,
    isBounded: false,
    preventCollision: false,
    allowOverlap: false,
    containerPadding: [0, 0] as [number, number],
    useCSSTransforms: true,
  }), [])

  // Handle layout change (drag/resize)
  const handleLayoutChange = useCallback((newLayout: Layout[]) => {
    setLayout(newLayout)
    setLayoutBlocks(prev => prev.map(block => {
      const layoutItem = newLayout.find(l => l.i === block.id)
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
    }))
  }, [])

  // Add field block
  const handleAddField = useCallback((fieldName: string) => {
    const field = fields.find(f => f.name === fieldName || f.id === fieldName)
    if (!field) return

    // Find next available position
    const maxY = layoutBlocks.length > 0
      ? Math.max(...layoutBlocks.map(b => b.y + b.h))
      : 0

    const newBlock: ModalLayoutBlock = {
      id: `field-${field.id}-${Date.now()}`,
      type: 'field',
      fieldName: field.name,
      x: 0,
      y: maxY,
      w: 4,
      h: 3,
      config: {
        field_id: field.id,
        field_name: field.name,
      },
    }

    setLayoutBlocks(prev => [...prev, newBlock])
    setAddFieldValue("")
  }, [fields, layoutBlocks])

  // Remove block
  const handleRemoveBlock = useCallback((blockId: string) => {
    setLayoutBlocks(prev => prev.filter(b => b.id !== blockId))
  }, [])

  // Convert blocks to PageBlock format for rendering
  const pageBlocks = useMemo(() => {
    return layoutBlocks.map(block => ({
      id: block.id,
      type: block.type === 'field' ? 'field' : block.type,
      x: block.x,
      y: block.y,
      w: block.w,
      h: block.h,
      config: {
        ...block.config,
        field_id: block.type === 'field' ? fields.find(f => f.name === block.fieldName)?.id : undefined,
        field_name: block.fieldName,
      },
    })) as any[]
  }, [layoutBlocks, fields])

  // Save layout
  const handleSave = useCallback(() => {
    const modalLayout = {
      blocks: layoutBlocks,
      layoutSettings: {
        cols: 8,
        rowHeight: 30,
        margin: [8, 8] as [number, number],
      },
    }
    onSave(modalLayout)
    onOpenChange(false)
  }, [layoutBlocks, onSave, onOpenChange])

  // Reset to default (simple field list)
  const handleReset = useCallback(() => {
    if ((config as any).modal_fields && Array.isArray((config as any).modal_fields)) {
      const modalFields = (config as any).modal_fields as string[]
      const defaultBlocks: ModalLayoutBlock[] = modalFields.map((fieldName, index) => {
        const field = fields.find(f => f.name === fieldName || f.id === fieldName)
        if (!field) return null
        return {
          id: `field-${field.id}`,
          type: 'field',
          fieldName: field.name,
          x: index % 2 === 0 ? 0 : 4,
          y: Math.floor(index / 2),
          w: 4,
          h: 3,
          config: {
            field_id: field.id,
            field_name: field.name,
          },
        }
      }).filter((b): b is ModalLayoutBlock => b !== null)
      setLayoutBlocks(defaultBlocks)
    } else {
      setLayoutBlocks([])
    }
  }, [config, fields])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Edit Modal Layout</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          {/* Controls */}
          <div className="flex items-center justify-between gap-4 border-b pb-4">
            <div className="flex items-center gap-2 flex-1">
              <Label>Add Field</Label>
              {availableFields.length > 0 ? (
                <Select value={addFieldValue} onValueChange={(value) => {
                  if (value) {
                    handleAddField(value)
                  }
                }}>
                  <SelectTrigger className="w-64">
                    <SelectValue placeholder="Select a field..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableFields.map((field) => (
                      <SelectItem key={field.id} value={field.name}>
                        {getFieldDisplayName(field)} ({field.type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm text-gray-500">All fields are already in the layout</p>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={handleReset}>
              Reset to Default
            </Button>
          </div>

          {/* Canvas Preview */}
          <div className="flex-1 overflow-auto border rounded-lg bg-gray-50 p-4">
            {layoutBlocks.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-400">
                <p>No fields in layout. Add fields using the dropdown above.</p>
              </div>
            ) : (
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
                isDraggable={true}
                isResizable={true}
                onLayoutChange={handleLayoutChange}
                measureBeforeMount={false}
              >
                {pageBlocks.map((block) => (
                  <div key={block.id} className="block-wrapper bg-white border rounded shadow-sm relative group">
                    <ErrorBoundary blockId={block.id} blockType={block.type}>
                      <BlockAppearanceWrapper block={block}>
                        <div className="p-2">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium text-gray-600">
                              {block.type === 'field' && block.config?.field_name
                                ? getFieldDisplayName(fields.find(f => f.name === block.config.field_name) || fields[0])
                                : block.type}
                            </span>
                            <button
                              onClick={() => handleRemoveBlock(block.id)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-50 rounded"
                              title="Remove field"
                            >
                              <Trash2 className="h-3 w-3 text-red-600" />
                            </button>
                          </div>
                          <div className="text-xs text-gray-400">
                            Field preview
                          </div>
                        </div>
                      </BlockAppearanceWrapper>
                    </ErrorBoundary>
                  </div>
                ))}
              </ResponsiveGridLayout>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save Layout
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
