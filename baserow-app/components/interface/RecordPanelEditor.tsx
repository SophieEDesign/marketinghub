"use client"

import { useState, useEffect } from "react"
import { Plus, Type, Image, FileText, BarChart3, Trash2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/components/ui/use-toast"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { TableField } from "@/types/fields"
import type { InterfacePage } from "@/lib/interface/page-types-only"
import type { BlockType, PageBlock } from "@/lib/interface/types"

interface RecordPanelEditorProps {
  page: InterfacePage
  isOpen: boolean
  onClose: () => void
  onSave: () => void
}

export default function RecordPanelEditor({ page, isOpen, onClose, onSave }: RecordPanelEditorProps) {
  const { toast } = useToast()
  const [fields, setFields] = useState<TableField[]>([])
  const [blocks, setBlocks] = useState<PageBlock[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedField, setSelectedField] = useState<string>("")
  const [selectedBlockType, setSelectedBlockType] = useState<BlockType>("text")

  // Load fields and blocks
  useEffect(() => {
    if (isOpen && page.id) {
      loadFields()
      loadBlocks()
    }
  }, [isOpen, page.id, page.base_table])

  async function loadFields() {
    if (!page.base_table) return

    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('table_fields')
        .select('id, name, type, position')
        .eq('table_id', page.base_table)
        .order('position', { ascending: true })

      if (error) throw error
      setFields(data || [])
    } catch (error: any) {
      console.error('Error loading fields:', error)
      toast({
        title: "Failed to load fields",
        description: error.message,
        variant: "destructive",
      })
    }
  }

  async function loadBlocks() {
    try {
      const res = await fetch(`/api/pages/${page.id}/blocks`)
      if (!res.ok) throw new Error('Failed to load blocks')
      
      const data = await res.json()
      setBlocks(data.blocks || [])
    } catch (error: any) {
      console.error('Error loading blocks:', error)
      toast({
        title: "Failed to load blocks",
        description: error.message,
        variant: "destructive",
      })
    }
  }

  async function handleAddFieldBlock() {
    if (!selectedField) return

    setLoading(true)
    try {
      // Get current max Y position to place new block below existing ones
      const maxY = blocks.length > 0 
        ? Math.max(...blocks.map(b => b.y + b.h))
        : 0

      // Create a text block with field reference in config via API
      const res = await fetch(`/api/pages/${page.id}/blocks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'text',
          x: 0,
          y: maxY,
          w: 12,
          h: 2,
          config: {
            field_name: selectedField,
            content: `{{${selectedField}}}`,
          },
        }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to add field block')
      }

      toast({
        title: "Field block added",
        description: "You can now edit and position it in edit mode.",
      })
      
      setSelectedField("")
      loadBlocks() // Reload to show new block
      onSave() // Notify parent to refresh
    } catch (error: any) {
      console.error('Error adding field block:', error)
      toast({
        title: "Failed to add field block",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  async function handleAddContentBlock() {
    setLoading(true)
    try {
      // Get current max Y position
      const maxY = blocks.length > 0 
        ? Math.max(...blocks.map(b => b.y + b.h))
        : 0

      // Get default size for block type
      const defaultSizes: Partial<Record<BlockType, { w: number; h: number }>> = {
        text: { w: 12, h: 2 },
        image: { w: 6, h: 4 },
        chart: { w: 6, h: 4 },
        grid: { w: 12, h: 6 },
        form: { w: 12, h: 4 },
        kpi: { w: 4, h: 2 },
        divider: { w: 12, h: 1 },
        record: { w: 12, h: 6 },
      }

      const size = (defaultSizes[selectedBlockType] as { w: number; h: number } | undefined) || { w: 12, h: 2 }

      // Create block via API
      const res = await fetch(`/api/pages/${page.id}/blocks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: selectedBlockType,
          x: 0,
          y: maxY,
          w: size.w,
          h: size.h,
          config: {},
        }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to add block')
      }

      toast({
        title: "Block added",
        description: "You can now edit and position it in edit mode.",
      })
      
      loadBlocks() // Reload to show new block
      onSave() // Notify parent to refresh
    } catch (error: any) {
      console.error('Error adding block:', error)
      toast({
        title: "Failed to add block",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  async function handleDeleteBlock(blockId: string) {
    setLoading(true)
    try {
      const res = await fetch(`/api/pages/${page.id}/blocks/${blockId}`, {
        method: 'DELETE',
      })

      if (!res.ok) throw new Error('Failed to delete block')

      toast({
        title: "Block deleted",
      })
      
      loadBlocks() // Reload
      onSave() // Notify parent to refresh
    } catch (error: any) {
      console.error('Error deleting block:', error)
      toast({
        title: "Failed to delete block",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  // Get fields that aren't already used in blocks
  const usedFieldNames = new Set(
    blocks
      .filter(b => b.type === 'text' && b.config?.field_name)
      .map(b => b.config.field_name)
  )
  const availableFields = fields.filter(f => !usedFieldNames.has(f.name))

  const blockTypes: { value: BlockType; label: string; icon: any }[] = [
    { value: 'text', label: 'Text', icon: Type },
    { value: 'image', label: 'Image', icon: Image },
    { value: 'chart', label: 'Chart', icon: BarChart3 },
  ]

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Add Blocks to Panel</SheetTitle>
          <SheetDescription>
            Add fields or content blocks to the record panel. After adding, enter edit mode to drag and position them.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Add Field Block */}
          {page.base_table && (
            <div className="space-y-2">
              <Label>Add Field Block</Label>
              <div className="text-sm text-gray-500 mb-2">
                Display a field value from the record
              </div>
              <div className="flex gap-2">
                <Select value={selectedField} onValueChange={setSelectedField}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select a field" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableFields.length > 0 ? (
                      availableFields.map((field) => (
                        <SelectItem key={field.id} value={field.name}>
                          {field.name} ({field.type})
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="" disabled>No available fields</SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <Button onClick={handleAddFieldBlock} disabled={!selectedField || loading}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add
                </Button>
              </div>
            </div>
          )}

          {/* Add Content Block */}
          <div className="space-y-2">
            <Label>Add Content Block</Label>
            <div className="text-sm text-gray-500 mb-2">
              Add text, images, charts, or other content
            </div>
            <div className="flex gap-2">
              <Select value={selectedBlockType} onValueChange={(value) => setSelectedBlockType(value as BlockType)}>
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {blockTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      <div className="flex items-center gap-2">
                        <type.icon className="h-4 w-4" />
                        {type.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={handleAddContentBlock} variant="outline" disabled={loading}>
                <Plus className="h-4 w-4 mr-2" />
                Add
              </Button>
            </div>
          </div>

          {/* Current Blocks */}
          <div className="space-y-2">
            <Label>Current Blocks ({blocks.length})</Label>
            {blocks.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm border border-dashed border-gray-200 rounded-md">
                No blocks yet. Add fields or blocks above.
              </div>
            ) : (
              <div className="space-y-2">
                {blocks.map((block) => {
                  const isFieldBlock = block.type === 'text' && block.config?.field_name
                  return (
                    <div
                      key={block.id}
                      className="flex items-center gap-2 p-3 bg-white border border-gray-200 rounded-md"
                    >
                      <div className="flex-1 flex items-center gap-2">
                        {isFieldBlock ? (
                          <>
                            <div className="h-8 w-8 rounded bg-blue-100 flex items-center justify-center">
                              <span className="text-xs font-medium text-blue-700">F</span>
                            </div>
                            <div className="flex-1">
                              <div className="text-sm font-medium text-gray-900">
                                {block.config.field_name}
                              </div>
                              <div className="text-xs text-gray-500">Field block</div>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="h-8 w-8 rounded bg-purple-100 flex items-center justify-center">
                              <Type className="h-4 w-4 text-purple-700" />
                            </div>
                            <div className="flex-1">
                              <div className="text-sm font-medium text-gray-900 capitalize">
                                {block.type}
                              </div>
                              <div className="text-xs text-gray-500">Content block</div>
                            </div>
                          </>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-gray-400 hover:text-red-600"
                        onClick={() => handleDeleteBlock(block.id)}
                        disabled={loading}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-sm text-blue-800">
              <strong>Tip:</strong> After adding blocks, click &quot;Done&quot; and enter edit mode to drag and position them, just like content pages.
            </p>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={onClose} disabled={loading}>
              Done
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
