"use client"

/**
 * @deprecated This component is deprecated. Use PageCreationWizard instead.
 * This component mixes Interface creation with Page creation, which violates
 * the product model: "Interfaces group pages. Pages render content. Creation flows must never mix the two."
 * 
 * Migration: Replace all usages of NewPageModal with PageCreationWizard.
 */

import { useState, useEffect, useCallback } from "react"
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
import { PAGE_TYPE_CATEGORIES, type PageTypeTemplate } from "@/lib/interface/pageTypes.types"
import { seedBlocksFromTemplate } from "@/lib/interface/pageTypes.client"

interface NewPageModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultGroupId?: string | null
}

export default function NewPageModal({ open, onOpenChange, defaultGroupId }: NewPageModalProps) {
  const router = useRouter()
  const [isAdmin, setIsAdmin] = useState(false)
  
  const [name, setName] = useState("")
  const [icon, setIcon] = useState("")
  const [primaryTableId, setPrimaryTableId] = useState<string>("")
  const [selectedPageType, setSelectedPageType] = useState<string>("")
  const [tables, setTables] = useState<Array<{ id: string; name: string }>>([])
  const [pageTypes, setPageTypes] = useState<PageTypeTemplate[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingTables, setLoadingTables] = useState(false)
  const [loadingPageTypes, setLoadingPageTypes] = useState(false)

  const loadTables = useCallback(async () => {
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
  }, [primaryTableId])

  const loadPageTypes = useCallback(async () => {
    setLoadingPageTypes(true)
    try {
      const response = await fetch('/api/page-types')
      if (!response.ok) throw new Error('Failed to load page types')
      const data = await response.json()
      setPageTypes(data.templates || [])
      
      // Set default selection to first available type
      if (data.templates && data.templates.length > 0 && !selectedPageType) {
        setSelectedPageType(data.templates[0].type)
      }
    } catch (error) {
      console.error('Error loading page types:', error)
    } finally {
      setLoadingPageTypes(false)
    }
  }, [selectedPageType])

  useEffect(() => {
    // Check if user is admin
    const checkAdmin = async () => {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single()
          setIsAdmin(profile?.role === 'admin')
        }
      } catch (error) {
        console.error('Error checking admin status:', error)
      }
    }
    
    if (open) {
      checkAdmin()
      loadTables()
      loadPageTypes()
    }
  }, [open, loadTables, loadPageTypes])

  async function handleCreate() {
    if (!name.trim()) {
      alert("Interface name is required")
      return
    }

    if (!primaryTableId) {
      alert("Please select a primary table")
      return
    }

    if (!selectedPageType) {
      alert("Please select a page type")
      return
    }

    setLoading(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      // Get the selected template
      const template = pageTypes.find(t => t.type === selectedPageType)
      if (!template) {
        throw new Error('Selected page type template not found')
      }

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
            page_type: selectedPageType, // Store page type
            config: {
              settings: {
                icon: icon.trim() || null,
                access: 'authenticated',
                layout: { cols: 12, rowHeight: 30, margin: [10, 10] },
                primary_table_id: primaryTableId,
                page_type: selectedPageType, // Also store in config for backward compatibility
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
        // Seed blocks from template
        const blocksToCreate = seedBlocksFromTemplate(template, primaryTableId).map((blockDef, index) => ({
          view_id: view.id,
          type: blockDef.type,
          position_x: blockDef.x,
          position_y: blockDef.y,
          width: blockDef.w,
          height: blockDef.h,
          order_index: index,
          config: blockDef.config,
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
        setSelectedPageType("")
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
    setSelectedPageType("")
    onOpenChange(false)
  }

  // Group page types by category
  const groupedTypes = PAGE_TYPE_CATEGORIES.map(category => ({
    ...category,
    templates: pageTypes.filter(t => t.category === category.id),
  })).filter(group => group.templates.length > 0)

  const selectedTemplate = pageTypes.find(t => t.type === selectedPageType)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Interface</DialogTitle>
          <DialogDescription>
            Choose a page type to get started with a pre-configured layout, or start from scratch.
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
                if (e.key === "Enter" && name.trim() && primaryTableId && selectedPageType) {
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
            <Label>Page Type *</Label>
            {loadingPageTypes ? (
              <div className="text-sm text-muted-foreground">Loading page types...</div>
            ) : (
              <div className="space-y-4">
                {groupedTypes.map((category) => (
                  <div key={category.id} className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                      <span>{category.icon}</span>
                      <span>{category.label}</span>
                      <span className="text-xs font-normal text-gray-500">({category.description})</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 pl-6">
                      {category.templates.map((template) => (
                        <button
                          key={template.type}
                          type="button"
                          onClick={() => setSelectedPageType(template.type)}
                          className={`p-3 rounded-lg border-2 transition-all text-left ${
                            selectedPageType === template.type
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <span className="text-xl flex-shrink-0">{template.icon || '📄'}</span>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm text-gray-900">{template.label}</div>
                              {template.description && (
                                <div className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                                  {template.description}
                                </div>
                              )}
                              {template.admin_only && (
                                <div className="text-xs text-orange-600 mt-1">Admin only</div>
                              )}
                            </div>
                            {selectedPageType === template.type && (
                              <div className="flex-shrink-0">
                                <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                </div>
                              </div>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {selectedTemplate && selectedTemplate.default_blocks.length > 0 && (
              <div className="mt-2 p-3 bg-muted rounded-lg">
                <p className="text-xs font-medium mb-1">This template includes:</p>
                <ul className="text-xs text-muted-foreground list-disc list-inside space-y-0.5">
                  {selectedTemplate.default_blocks.map((block, idx) => (
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
          <Button 
            onClick={handleCreate} 
            disabled={loading || !name.trim() || !primaryTableId || !selectedPageType}
          >
            {loading ? "Creating..." : "Create Interface"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

