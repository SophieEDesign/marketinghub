"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import Canvas from "@/components/interface/Canvas"
import { FilterStateProvider } from "@/lib/interface/filter-state"
import type { PageBlock, LayoutItem } from "@/lib/interface/types"
import type { TableField } from "@/types/fields"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface RecordDetailCanvasProps {
  tableId: string
  recordId: string
  blockConfig?: Record<string, unknown> | null
  blockId: string
  isEditing?: boolean
  pageEditable?: boolean
  onBlockUpdate?: (blockId: string, config: Partial<Record<string, unknown>>) => void
}

function defaultBlockH(field: TableField): number {
  return field.type === "link_to_table" || field.type === "lookup" ? 3 : 2
}

/**
 * Resolve visible field names from block config (field_layout, modal_fields, visible_fields).
 */
function getVisibleFieldNames(config: Record<string, unknown> | null | undefined): string[] {
  if (!config) return []
  const fl = config.field_layout as Array<{ field_name: string; visible_in_canvas?: boolean; visible_in_modal?: boolean; order?: number }> | undefined
  if (Array.isArray(fl) && fl.length > 0) {
    return fl
      .filter((i) => i.visible_in_canvas !== false && i.visible_in_modal !== false)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((i) => i.field_name)
  }
  const mf = Array.isArray(config.modal_fields) ? config.modal_fields : []
  const vf = Array.isArray(config.visible_fields) ? config.visible_fields : []
  return mf.length > 0 ? (mf as string[]) : (vf as string[])
}

/**
 * Record detail right panel as a canvas editor. Selected fields become field blocks
 * that can be dragged and resized. Layout is persisted to record_field_layout.
 */
export default function RecordDetailCanvas({
  tableId,
  recordId,
  blockConfig,
  blockId,
  isEditing = false,
  pageEditable = true,
  onBlockUpdate,
}: RecordDetailCanvasProps) {
  const [tableFields, setTableFields] = useState<TableField[]>([])
  const [loading, setLoading] = useState(true)
  const [currentBlocks, setCurrentBlocks] = useState<PageBlock[]>([])
  const hasInitializedRef = useRef(false)

  const visibleFieldNames = getVisibleFieldNames(blockConfig)
  // When no fields configured, show all (empty = show all, like RecordContextDataSettings)
  const effectiveFieldNames =
    visibleFieldNames.length > 0
      ? visibleFieldNames
      : tableFields.map((f) => f.name).filter(Boolean)
  const recordFields = effectiveFieldNames.map((field, idx) => ({
    field,
    editable: pageEditable !== false,
    order: idx,
  }))

  const recordFieldSet = new Set(
    recordFields
      .map((c) => {
        const f = tableFields.find((tf) => tf.name === c.field || tf.id === c.field)
        return f?.name
      })
      .filter(Boolean) as string[]
  )

  const storedLayout = (blockConfig?.record_field_layout as PageBlock[] | undefined) || null

  const createFieldBlocks = useCallback(
    (template?: PageBlock[]): PageBlock[] => {
      if (template && template.length > 0) {
        const existingByField = new Map<string, PageBlock>()
        for (const block of template) {
          const fieldName = (block.config?.field_name as string) || ""
          if (fieldName && recordFieldSet.has(fieldName)) {
            existingByField.set(fieldName, block)
          }
        }

        const result: PageBlock[] = []
        let maxY = -1
        for (const block of template) {
          const fieldName = (block.config?.field_name as string) || ""
          if (fieldName && recordFieldSet.has(fieldName)) {
            const h = block.h ?? 2
            maxY = Math.max(maxY, (block.y ?? 0) + h)
            result.push({
              ...block,
              id: `field-${recordId}-${fieldName}`,
              page_id: blockId,
              config: {
                ...block.config,
                table_id: tableId,
                field_name: fieldName,
                allow_inline_edit: pageEditable !== false,
              },
            })
          }
        }

        let newBlockIndex = 0
        for (const { field } of recordFields) {
          const tf = tableFields.find((f) => f.name === field || f.id === field)
          if (!tf || existingByField.has(tf.name)) continue
          const row = Math.floor(newBlockIndex / 2)
          const col = newBlockIndex % 2
          const y = maxY + 1 + row * 2
          result.push({
            id: `field-${recordId}-${tf.name}`,
            page_id: blockId,
            type: "field",
            x: col === 0 ? 0 : 6,
            y,
            w: 6,
            h: defaultBlockH(tf),
            config: {
              field_id: tf.id,
              field_name: tf.name,
              table_id: tableId,
              allow_inline_edit: pageEditable !== false,
            },
            order_index: result.length,
            created_at: new Date().toISOString(),
          })
          newBlockIndex++
        }
        return result
      }

      if (recordFields.length === 0) {
        const defaultFields = tableFields.slice(0, 10)
        return defaultFields.map((field, index) => ({
          id: `field-${recordId}-${field.name}`,
          page_id: blockId,
          type: "field" as const,
          x: index % 2 === 0 ? 0 : 6,
          y: Math.floor(index / 2) * 2,
          w: 6,
          h: defaultBlockH(field),
          config: {
            field_id: field.id,
            field_name: field.name,
            table_id: tableId,
            allow_inline_edit: pageEditable !== false,
          },
          order_index: index,
          created_at: new Date().toISOString(),
        }))
      }

      return recordFields
        .map((fieldConfig, index) => {
          const field = tableFields.find((f) => f.name === fieldConfig.field || f.id === fieldConfig.field)
          if (!field) return null
          return {
            id: `field-${recordId}-${field.name}`,
            page_id: blockId,
            type: "field" as const,
            x: index % 2 === 0 ? 0 : 6,
            y: Math.floor(index / 2) * 2,
            w: 6,
            h: defaultBlockH(field),
            config: {
              field_id: field.id,
              field_name: field.name,
              table_id: tableId,
              allow_inline_edit: fieldConfig.editable !== false,
            },
            order_index: index,
            created_at: new Date().toISOString(),
          }
        })
        .filter((b): b is PageBlock => b != null)
    },
    [recordId, blockId, tableId, recordFields, recordFieldSet, tableFields, pageEditable]
  )

  useEffect(() => {
    if (!tableId) {
      setLoading(false)
      return
    }
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const supabase = createClient()
        const { data: table } = await supabase
          .from("tables")
          .select("supabase_table")
          .eq("id", tableId)
          .single()

        if (cancelled) return
        if (!table?.supabase_table) {
          setTableFields([])
          return
        }

        const response = await fetch(`/api/tables/${tableId}/fields`, { cache: "no-store" })
        if (cancelled) return
        if (!response.ok) {
          setTableFields([])
          return
        }
        const data = await response.json()
        if (cancelled) return
        setTableFields(Array.isArray(data?.fields) ? data.fields : [])
      } catch {
        if (!cancelled) setTableFields([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [tableId])

  useEffect(() => {
    if (storedLayout && storedLayout.length > 0) {
      setCurrentBlocks(storedLayout)
    }
  }, [storedLayout])

  // When entering edit mode, build blocks from stored layout or visible fields
  useEffect(() => {
    if (!isEditing) {
      hasInitializedRef.current = false
      return
    }
    if (loading || tableFields.length === 0) return
    if (hasInitializedRef.current) return
    hasInitializedRef.current = true
    const blocks = createFieldBlocks(storedLayout || undefined)
    setCurrentBlocks(blocks)
    if (onBlockUpdate) onBlockUpdate(blockId, { record_field_layout: blocks })
  }, [isEditing, loading, tableFields.length, storedLayout, createFieldBlocks, blockId, onBlockUpdate])

  const handleLayoutChange = useCallback(
    (layout: LayoutItem[]) => {
      if (!isEditing) return
      setCurrentBlocks((prev) => {
        const updated = prev.map((block) => {
          const item = layout.find((i) => i.i === block.id)
          if (item) {
            return { ...block, x: item.x, y: item.y, w: item.w, h: item.h }
          }
          return block
        })
        if (onBlockUpdate) setTimeout(() => onBlockUpdate(blockId, { record_field_layout: updated }), 300)
        return updated
      })
    },
    [isEditing, blockId, onBlockUpdate]
  )

  const handleBlockDelete = useCallback(
    (id: string) => {
      setCurrentBlocks((prev) => {
        const updated = prev.filter((b) => b.id !== id)
        if (onBlockUpdate) onBlockUpdate(blockId, { record_field_layout: updated })
        return updated
      })
    },
    [blockId, onBlockUpdate]
  )

  const handleAddFieldBlock = useCallback(
    (fieldName: string) => {
      const field = tableFields.find((f) => f.name === fieldName || f.id === fieldName)
      if (!field) return
      const inLayout = currentBlocks.some((b) => (b.config?.field_name as string) === field.name)
      if (inLayout) return
      setCurrentBlocks((prev) => {
        const maxY = prev.length > 0 ? Math.max(...prev.map((b) => (b.y ?? 0) + (b.h ?? 2))) : -1
        const y = maxY + 1
        const newBlock: PageBlock = {
          id: `field-${recordId}-${field.name}`,
          page_id: blockId,
          type: "field",
          x: 0,
          y,
          w: 6,
          h: defaultBlockH(field),
          config: {
            field_id: field.id,
            field_name: field.name,
            table_id: tableId,
            allow_inline_edit: pageEditable !== false,
          },
          order_index: prev.length,
          created_at: new Date().toISOString(),
        }
        const updated = [...prev, newBlock]
        if (onBlockUpdate) onBlockUpdate(blockId, { record_field_layout: updated })
        return updated
      })
    },
    [tableFields, currentBlocks, recordId, blockId, tableId, pageEditable, onBlockUpdate]
  )

  const handleBlockConfigUpdate = useCallback(
    (blockIdToUpdate: string, config: Partial<Record<string, unknown>>) => {
      setCurrentBlocks((prev) => {
        const updated = prev.map((b) =>
          b.id === blockIdToUpdate ? { ...b, config: { ...b.config, ...config } } : b
        )
        if (onBlockUpdate) onBlockUpdate(blockId, { record_field_layout: updated })
        return updated
      })
    },
    [blockId, onBlockUpdate]
  )

  const fieldsInLayout = new Set(
    currentBlocks.map((b) => b.config?.field_name as string).filter(Boolean)
  )
  const availableToAdd = tableFields.filter(
    (f) => !fieldsInLayout.has(f.name) && recordFieldSet.has(f.name)
  )

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
        Loading…
      </div>
    )
  }

  const displayBlocks = currentBlocks.length > 0 ? currentBlocks : createFieldBlocks(storedLayout || undefined)
  const canEdit = isEditing && pageEditable !== false

  return (
    <div className="h-full w-full min-w-0 flex flex-col overflow-hidden">
      {canEdit && availableToAdd.length > 0 && (
        <div className="flex items-center gap-3 px-3 py-2 border-b bg-muted/40 shrink-0">
          <Select value="" onValueChange={(v) => v && handleAddFieldBlock(v)}>
            <SelectTrigger className="w-[200px] h-8 text-xs">
              <SelectValue placeholder="Add a field…" />
            </SelectTrigger>
            <SelectContent>
              {availableToAdd.map((f) => (
                <SelectItem key={f.id} value={f.name}>
                  {f.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">
            Drag to move · Resize with the corner · Delete to remove
          </span>
        </div>
      )}
      <div className="flex-1 min-h-0 overflow-auto p-4">
        <FilterStateProvider>
          <Canvas
            blocks={displayBlocks}
            isEditing={canEdit}
            onLayoutChange={canEdit ? handleLayoutChange : undefined}
            onBlockUpdate={canEdit ? handleBlockConfigUpdate : undefined}
            onBlockDelete={canEdit ? handleBlockDelete : undefined}
            pageTableId={tableId}
            pageId={blockId}
            recordId={recordId}
            mode={canEdit ? "edit" : "view"}
            pageEditable={pageEditable}
            layoutSettings={{ cols: 12, rowHeight: 30, margin: [10, 10] }}
          />
        </FilterStateProvider>
      </div>
    </div>
  )
}
