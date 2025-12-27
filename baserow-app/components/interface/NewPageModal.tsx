"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { createClient } from "@/lib/supabase/client"
import { IconPicker } from "@/components/ui/icon-picker"
import { LAYOUT_TEMPLATES, type LayoutTemplate } from "@/lib/interface/layoutTemplates"
import type { BlockType } from "@/lib/interface/types"

interface NewPageModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultGroupId?: string | null
}

export default function NewPageModal({ open, onOpenChange, defaultGroupId }: NewPageModalProps) {
  const router = useRouter()
  const [name, setName] = useState("")
  const [icon, setIcon] = useState("")
  const [primaryTableId, setPrimaryTableId] = useState<string>("")
  const [layoutTemplate, setLayoutTemplate] = useState<LayoutTemplate>("table")
  const [tables, setTables] = useState<Array<{ id: string; name: string }>>([])
  const [loading, setLoading] = useState(false)
  const [loadingTables, setLoadingTables] = useState(false)

  useEffect(() => {
    if (open) {
      loadTables()
    }
  }, [open])

  async function loadTables() {
    setLoadingTables(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('tables')
        .select('id, name')
        .order('name', { ascending: true })

      if (error) throw error
      setTables(data || [])
      if (data && data.length > 0 && !primaryTableId) {
        setPrimaryTableId(data[0].id)
      }
    } catch (error) {
      console.error('Error loading tables:', error)
    } finally {
      setLoadingTables(false)
    }
  }

  async function handleCreate() {
    if (!name.trim()) {
      alert("Interface name is required")
      return
    }

    if (!primaryTableId) {
      alert("Please select a primary table")
      return
    }

    setLoading(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      // Get max order_index for the group (or uncategorized)
      const { data: lastInterface } = await supabase
        .from('views')
        .select('order_index')
        .eq('type', 'interface')
        .eq('group_id', defaultGroupId || null)
        .order('order_index', { ascending: false })
        .limit(1)
        .maybeSingle()

      const orderIndex = lastInterface ? (lastInterface.order_index + 1) : 0

      // Create interface page as a view with type='interface'
      const { data: view, error: viewError } = await supabase
        .from('views')
        .insert([
          {
            name: name.trim(),
            type: 'interface',
            table_id: primaryTableId,
            group_id: defaultGroupId || null,
            order_index: orderIndex,
            config: {
              settings: {
                icon: icon.trim() || null,
                access: 'authenticated',
                layout: { cols: 12, rowHeight: 30, margin: [10, 10] },
                primary_table_id: primaryTableId,
                layout_template: layoutTemplate,
              },
            },
            owner_id: user?.id,
            access_level: 'authenticated',
          },
        ])
        .select()
        .single()

      if (viewError) {
        throw new Error(viewError.message || "Failed to create interface")
      }

      if (view) {
        // Create blocks based on the selected layout template
        const template = LAYOUT_TEMPLATES[layoutTemplate]
        const blocksToCreate = template.blocks.map((blockDef, index) => ({
          view_id: view.id,
          type: blockDef.type,
          position_x: blockDef.x,
          position_y: blockDef.y,
          width: blockDef.w,
          height: blockDef.h,
          order_index: index,
          config: {
            ...blockDef.config,
            table_id: primaryTableId, // Bind all blocks to primary table
          },
        }))

        if (blocksToCreate.length > 0) {
          const { error: blocksError } = await supabase
            .from('view_blocks')
            .insert(blocksToCreate)

          if (blocksError) {
            console.error('Error creating blocks:', blocksError)
            // Continue anyway - blocks can be added manually
          }
        }

        // Reset form
        setName("")
        setIcon("")
        setPrimaryTableId("")
        setLayoutTemplate("table")
        onOpenChange(false)
        // Redirect to the new interface route
        router.push(`/pages/${view.id}`)
        router.refresh()
        window.dispatchEvent(new CustomEvent('pages-updated'))
      }
    } catch (error: any) {
      console.error("Failed to create interface:", error)
      alert(error.message || "Failed to create interface")
    } finally {
      setLoading(false)
    }
  }

  function handleCancel() {
    setName("")
    setIcon("")
    setPrimaryTableId("")
    setLayoutTemplate("table")
    onOpenChange(false)
  }

  const selectedTemplate = LAYOUT_TEMPLATES[layoutTemplate]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Interface</DialogTitle>
          <DialogDescription>
            Set up your interface with a primary table and choose a layout template to get started.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 py-4">
          <div className="grid gap-2">
            <Label htmlFor="page-name">Interface Name *</Label>
            <Input
              id="page-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Dashboard"
              onKeyDown={(e) => {
                if (e.key === "Enter" && name.trim() && primaryTableId) {
                  handleCreate()
                }
              }}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="primary-table">Primary Table *</Label>
            {loadingTables ? (
              <div className="text-sm text-muted-foreground">Loading tables...</div>
            ) : (
              <Select value={primaryTableId} onValueChange={setPrimaryTableId}>
                <SelectTrigger id="primary-table">
                  <SelectValue placeholder="Select a table" />
                </SelectTrigger>
                <SelectContent>
                  {tables.map((table) => (
                    <SelectItem key={table.id} value={table.id}>
                      {table.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <p className="text-xs text-muted-foreground">
              The primary table will be used for all blocks in this interface
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="layout-template">Default Layout *</Label>
            <Select value={layoutTemplate} onValueChange={(value) => setLayoutTemplate(value as LayoutTemplate)}>
              <SelectTrigger id="layout-template">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(LAYOUT_TEMPLATES).map(([key, template]) => (
                  <SelectItem key={key} value={key}>
                    <div className="flex items-center gap-2">
                      <span>{template.icon}</span>
                      <div>
                        <div className="font-medium">{template.name}</div>
                        <div className="text-xs text-muted-foreground">{template.description}</div>
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedTemplate && (
              <div className="mt-2 p-3 bg-muted rounded-lg">
                <p className="text-xs font-medium mb-1">This template includes:</p>
                <ul className="text-xs text-muted-foreground list-disc list-inside space-y-0.5">
                  {selectedTemplate.blocks.map((block, idx) => (
                    <li key={idx}>
                      {block.type.charAt(0).toUpperCase() + block.type.slice(1)} block ({block.w}×{block.h})
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="grid gap-2">
            <Label>Icon</Label>
            <IconPicker
              value={icon}
              onChange={setIcon}
              placeholder="📊"
            />
            <p className="text-xs text-muted-foreground">
              Optional: Select an icon to represent this interface
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={loading || !name.trim() || !primaryTableId}>
            {loading ? "Creating..." : "Create Interface"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
