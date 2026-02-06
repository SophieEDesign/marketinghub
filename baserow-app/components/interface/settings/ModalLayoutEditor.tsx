"use client"

/**
 * DEPRECATED: Primary UX is now in-modal layout editing.
 * Open a record in the grid/calendar and use "Edit layout" in the record modal to customize layout (WYSIWYG).
 * This dialog is kept only as a potential fallback (e.g. when no records exist yet). Do not enhance.
 */

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
import { X, Plus, Trash2, Type } from "lucide-react"
import type { BlockConfig } from "@/lib/interface/types"
import type { TableField } from "@/types/database"
import { getFieldDisplayName } from "@/lib/fields/display"
import BlockRenderer from "../BlockRenderer"
import BlockAppearanceWrapper from "../BlockAppearanceWrapper"
import { ErrorBoundary } from "../ErrorBoundary"
import { createClient } from "@/lib/supabase/client"
import { isAbortError } from "@/lib/api/error-handling"
import { MODAL_CANVAS_LAYOUT_DEFAULTS, MODAL_CANVAS_LAYOUT_CONSTRAINTS } from "@/lib/interface/canvas-layout-defaults"

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
  const [previewRecord, setPreviewRecord] = useState<Record<string, any> | null>(null)
  const [previewRecordId, setPreviewRecordId] = useState<string | null>(null)
  const [tableName, setTableName] = useState<string | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)

  // Load table name and preview record
  useEffect(() => {
    if (!open || !tableId) {
      setTableName(null)
      setPreviewRecord(null)
      setPreviewRecordId(null)
      return
    }

    async function loadTableAndPreview() {
      setLoadingPreview(true)
      try {
        const supabase = createClient()
        
        // Load table name
        const { data: table } = await supabase
          .from("tables")
          .select("supabase_table")
          .eq("id", tableId)
          .single()

        if (!table?.supabase_table) {
          setLoadingPreview(false)
          return
        }

        setTableName(table.supabase_table)

        // Load first record for preview
        const { data: records, error } = await supabase
          .from(table.supabase_table)
          .select("*")
          .limit(1)
          .order("created_at", { ascending: false })

        if (error && !isAbortError(error)) {
          console.error("Error loading preview record:", error)
        } else if (records && records.length > 0) {
          setPreviewRecord(records[0])
          setPreviewRecordId(records[0].id)
        }
      } catch (error: any) {
        if (!isAbortError(error)) {
          console.error("Error loading preview:", error)
        }
      } finally {
        setLoadingPreview(false)
      }
    }

    loadTableAndPreview()
  }, [open, tableId])

  // Load existing modal layout or initialize from modal_fields
  useEffect(() => {
    if (!open) return

    if (config.modal_layout?.blocks) {
      // Load from existing modal_layout
      setLayoutBlocks(config.modal_layout.blocks)
    } else if ((config as any).modal_fields && Array.isArray((config as any).modal_fields)) {
      // Initialize from modal_fields (backward compatibility)
      const modalFields = (config as any).modal_fields as string[]
      const initialBlocks: ModalLayoutBlock[] = modalFields
        .map((fieldName, index) => {
          const field = fields.find(f => f.name === fieldName || f.id === fieldName)
          if (!field || !field.name) return null
          return {
            id: `field-${field.id}`,
            type: 'field' as const,
            fieldName: field.name,
            x: index % 2 === 0 ? 0 : 4,
            y: Math.floor(index / 2),
            w: 4,
            h: 3,
            config: {
              field_id: field.id,
              field_name: field.name,
            },
          } as ModalLayoutBlock
        })
        .filter((b): b is ModalLayoutBlock => b !== null)
      setLayoutBlocks(initialBlocks)
    } else {
      // Empty layout
      setLayoutBlocks([])
    }
  }, [open, config, fields])

  // Convert blocks to layout format (same constraints as ModalCanvas so preview matches modal)
  useEffect(() => {
    const layoutItems: Layout[] = layoutBlocks.map((block) => ({
      i: block.id,
      x: block.x,
      y: block.y,
      w: block.w,
      h: block.h,
      ...MODAL_CANVAS_LAYOUT_CONSTRAINTS,
    }))
    setLayout(layoutItems)
  }, [layoutBlocks])

  // Available fields (not already in layout)
  const availableFields = useMemo(() => {
    const usedFieldNames = new Set(layoutBlocks.filter(b => b.type === 'field').map(b => b.fieldName))
    return fields.filter(f => f.name !== 'id' && !usedFieldNames.has(f.name))
  }, [fields, layoutBlocks])

  // Grid configuration - use saved layoutSettings when present so editor preview matches modal
  const GRID_CONFIG = useMemo(() => {
    const settings = config.modal_layout?.layoutSettings
    const cols = settings?.cols ?? MODAL_CANVAS_LAYOUT_DEFAULTS.cols
    const rowHeight = settings?.rowHeight ?? MODAL_CANVAS_LAYOUT_DEFAULTS.rowHeight
    const margin = settings?.margin ?? MODAL_CANVAS_LAYOUT_DEFAULTS.margin
    return {
      cols: { lg: cols, md: 6, sm: 4, xs: 2, xxs: 2 },
      rowHeight,
      margin,
      compactType: null, // Disabled - we store absolute positions
      isBounded: false,
      preventCollision: false, // Allow blocks to adjust into grid
      allowOverlap: false,
      containerPadding: [0, 0] as [number, number],
      useCSSTransforms: true,
    }
  }, [config.modal_layout?.layoutSettings])

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

  // Add text block (static content block for modal sections)
  const handleAddTextBlock = useCallback(() => {
    const maxY = layoutBlocks.length > 0
      ? Math.max(...layoutBlocks.map(b => b.y + b.h))
      : 0

    const newBlock: ModalLayoutBlock = {
      id: `text-${Date.now()}`,
      type: 'text',
      x: 0,
      y: maxY,
      w: 4,
      h: 3,
      config: {
        content_json: { type: 'doc', content: [] },
      },
    }

    setLayoutBlocks(prev => [...prev, newBlock])
  }, [layoutBlocks])

  // Remove block
  const handleRemoveBlock = useCallback((blockId: string) => {
    setLayoutBlocks(prev => prev.filter(b => b.id !== blockId))
  }, [])

  // Update block config (e.g. text block content) so it persists when saving layout
  const handleUpdateBlockConfig = useCallback((blockId: string, configUpdate: Record<string, any>) => {
    setLayoutBlocks(prev => prev.map(b =>
      b.id === blockId ? { ...b, config: { ...b.config, ...configUpdate } } : b
    ))
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
        field_name: block.type === 'field' ? block.fieldName : undefined,
      },
    })) as any[]
  }, [layoutBlocks, fields])

  // Save layout (unified modal canvas settings)
  const handleSave = useCallback(() => {
    const modalLayout = {
      blocks: layoutBlocks,
      layoutSettings: {
        cols: MODAL_CANVAS_LAYOUT_DEFAULTS.cols,
        rowHeight: MODAL_CANVAS_LAYOUT_DEFAULTS.rowHeight,
        margin: MODAL_CANVAS_LAYOUT_DEFAULTS.margin,
      },
    }
    onSave(modalLayout)
    onOpenChange(false)
  }, [layoutBlocks, onSave, onOpenChange])

  // Reset to default (simple field list)
  const handleReset = useCallback(() => {
    if ((config as any).modal_fields && Array.isArray((config as any).modal_fields)) {
      const modalFields = (config as any).modal_fields as string[]
      const defaultBlocks: ModalLayoutBlock[] = modalFields
        .map((fieldName, index) => {
          const field = fields.find(f => f.name === fieldName || f.id === fieldName)
          if (!field || !field.name) return null
          return {
            id: `field-${field.id}`,
            type: 'field' as const,
            fieldName: field.name,
            x: index % 2 === 0 ? 0 : 4,
            y: Math.floor(index / 2),
            w: 4,
            h: 3,
            config: {
              field_id: field.id,
              field_name: field.name,
            },
          } as ModalLayoutBlock
        })
        .filter((b): b is ModalLayoutBlock => b !== null)
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
          <div className="flex items-center justify-between gap-4 border-b pb-4 flex-wrap">
            <div className="flex items-center gap-3 flex-1 flex-wrap">
              <div className="flex items-center gap-2">
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
                  <p className="text-sm text-gray-500">All fields in layout</p>
                )}
              </div>
              <span className="text-gray-400">or</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddTextBlock}
                className="gap-1.5"
              >
                <Type className="h-4 w-4" />
                Add Text block
              </Button>
            </div>
            <Button variant="outline" size="sm" onClick={handleReset}>
              Reset to Default
            </Button>
          </div>

          {/* Preview Info */}
          {previewRecordId && (
            <div className="px-3 py-2 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-800">
              <span className="font-medium">Preview:</span> Showing data from the most recent record. Drag and resize blocks to customize the layout.
            </div>
          )}

          {/* Canvas Preview */}
          <div className="flex-1 overflow-auto border rounded-lg bg-gray-50 p-4">
            {layoutBlocks.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-400">
                <p>No sections in layout. Add a field from the dropdown or add a Text block above.</p>
              </div>
            ) : loadingPreview ? (
              <div className="flex items-center justify-center h-full text-gray-400">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2" />
                  <p className="text-sm">Loading preview data...</p>
                </div>
              </div>
            ) : !previewRecordId ? (
              <div className="flex items-center justify-center h-full text-gray-400">
                <p className="text-sm">No records available for preview. Create a record to see how fields will appear.</p>
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
                    <ErrorBoundary>
                      <BlockAppearanceWrapper block={block}>
                        <div className="h-full w-full flex flex-col">
                          {/* Header with field name and remove button */}
                          <div className="flex items-center justify-between px-3 py-2 border-b bg-gray-50 flex-shrink-0">
                            <span className="text-xs font-medium text-gray-700">
                              {block.type === 'field' && block.config?.field_name
                                ? getFieldDisplayName(fields.find(f => f.name === block.config.field_name) || fields[0])
                                : block.type === 'text'
                                  ? 'Text block'
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
                          {/* Actual field block content - matches canvas styling */}
                          <div className="flex-1 overflow-auto min-h-0">
                            <BlockRenderer
                              block={block}
                              isEditing={block.type === 'text'}
                              onUpdate={block.type === 'text' ? (_, configUpdate) => handleUpdateBlockConfig(block.id, configUpdate) : undefined}
                              pageTableId={tableId}
                              recordId={previewRecordId}
                              mode="view"
                              pageEditable={false}
                            />
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
