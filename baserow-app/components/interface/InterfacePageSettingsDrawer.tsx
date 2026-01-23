"use client"

import { useState, useEffect } from "react"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Save } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Trash2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import type { InterfacePage } from "@/lib/interface/page-types-only"
import { PAGE_TYPE_DEFINITIONS, isRecordReviewPage } from "@/lib/interface/page-types"
import RecordReviewLeftPanelSettings from "./RecordReviewLeftPanelSettings"
import RecordViewLeftPanelSettings from "./RecordViewLeftPanelSettings"

interface InterfacePageSettingsDrawerProps {
  pageId: string
  isOpen: boolean
  onClose: () => void
  onUpdate: (updatedPage: InterfacePage) => void
}

interface InterfaceGroup {
  id: string
  name: string
}

export default function InterfacePageSettingsDrawer({
  pageId,
  isOpen,
  onClose,
  onUpdate,
}: InterfacePageSettingsDrawerProps) {
  const [page, setPage] = useState<InterfacePage | null>(null)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [pageType, setPageType] = useState<string>("")
  const [sourceTable, setSourceTable] = useState<string>("") // Changed from sourceView - users select tables, not SQL views
  const [baseTable, setBaseTable] = useState<string>("")
  const [interfaceId, setInterfaceId] = useState<string>("") // Changed from groupId - terminology fix
  const [isAdminOnly, setIsAdminOnly] = useState(true)
  const [interfaces, setInterfaces] = useState<InterfaceGroup[]>([]) // Changed from groups - terminology fix
  const [tables, setTables] = useState<Array<{ id: string; name: string }>>([])
  const [saving, setSaving] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [loading, setLoading] = useState(true)
  // Left panel settings for record_review pages (full field list)
  const [leftPanelSettings, setLeftPanelSettings] = useState<{
    visibleFieldIds: string[]
    fieldOrder: string[]
    showLabels: boolean
    compact: boolean
  } | null>(null)
  
  // Left panel settings for record_view pages (simplified: title, subtitle, additional)
  const [recordViewSettings, setRecordViewSettings] = useState<{
    titleFieldId: string | null
    subtitleFieldId: string | null
    additionalFieldId: string | null
  } | null>(null)
  
  // Right panel field selection for record_view pages (fields to auto-create as blocks)
  const [rightPanelFields, setRightPanelFields] = useState<string[]>([])
  const [availableFields, setAvailableFields] = useState<Array<{ id: string; name: string; type: string }>>([])

  useEffect(() => {
    if (isOpen && pageId) {
      setLoading(true)
      loadPage()
      loadInterfaces()
      loadTables()
    } else if (!isOpen) {
      // Reset state when drawer closes to prevent glitching
      setPage(null)
      setName("")
      setDescription("")
      setPageType("")
      setSourceTable("")
      setBaseTable("")
      setInterfaceId("")
      setIsAdminOnly(true)
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, pageId])

  async function loadPage() {
    try {
      const res = await fetch(`/api/interface-pages/${pageId}`)
      if (!res.ok) throw new Error('Failed to load page')
      
      const pageData = await res.json()
      setPage(pageData)
      setName(pageData.name || "")
      setDescription("") // InterfacePage doesn't have description field
      setPageType(pageData.page_type || "")
      // Map source_view to sourceTable for display (users see tables, not SQL views)
      // If page has source_view, we need to find which table it references
      // For now, store the table ID if available, otherwise use base_table
      setSourceTable(pageData.base_table || "")
      setBaseTable(pageData.base_table || "")
      setInterfaceId(pageData.group_id || "") // Interface is required, no "__none__" option
      setIsAdminOnly(pageData.is_admin_only ?? true)
      
      // Load left panel settings based on page type
      const config = pageData.config || {}
      const pageType = pageData.page_type as any
      
      if (pageType === 'record_review') {
        // Full field list configuration for record_review
        setLeftPanelSettings({
          visibleFieldIds: config.leftPanel?.visibleFieldIds || [],
          fieldOrder: config.leftPanel?.fieldOrder || [],
          showLabels: config.leftPanel?.showLabels ?? true,
          compact: config.leftPanel?.compact ?? false,
        })
        setRecordViewSettings(null)
      } else if (pageType === 'record_view') {
        // Simplified 3-field configuration for record_view
        setRecordViewSettings({
          titleFieldId: config.leftPanel?.titleFieldId || null,
          subtitleFieldId: config.leftPanel?.subtitleFieldId || null,
          additionalFieldId: config.leftPanel?.additionalFieldId || null,
        })
        setLeftPanelSettings(null)
        
        // Load right panel field selection
        setRightPanelFields(config.rightPanelFields || [])
        
        // Load available fields from the table
        const tableId = pageData.base_table || config.tableId
        if (tableId) {
          loadAvailableFields(tableId)
        }
      } else {
        setLeftPanelSettings(null)
        setRecordViewSettings(null)
        setRightPanelFields([])
      }
      
      setLoading(false)
    } catch (error) {
      console.error("Error loading page:", error)
      setLoading(false)
    }
  }

  async function loadInterfaces() {
    try {
      const supabase = createClient()
      const { data } = await supabase
        .from('interface_groups')
        .select('id, name')
        .order('name')
      
      if (data) {
        setInterfaces(data)
      }
    } catch (error) {
      console.error('Error loading interfaces:', error)
    }
  }

  async function loadTables() {
    try {
      const supabase = createClient()
      const { data } = await supabase
        .from('tables')
        .select('id, name')
        .order('name')
      
      if (data) {
        setTables(data)
      }
    } catch (error) {
      console.error('Error loading tables:', error)
    }
  }

  async function loadAvailableFields(tableId: string) {
    try {
      const supabase = createClient()
      const { data } = await supabase
        .from('table_fields')
        .select('id, name, type')
        .eq('table_id', tableId)
        .order('position', { ascending: true })
      
      if (data) {
        setAvailableFields(data)
      } else {
        setAvailableFields([])
      }
    } catch (error) {
      console.error('Error loading available fields:', error)
      setAvailableFields([])
    }
  }

  async function handleSave() {
    if (!name.trim() || !page) {
      return
    }

    // Interface is required
    if (!interfaceId) {
      alert('Please select an Interface')
      return
    }

    setSaving(true)
    try {
      // Build updates object - only include fields that are actually being changed
      // CRITICAL: Never send null for base_table unless user explicitly cleared it
      // Preserve existing base_table if user hasn't changed the selection
      const updates: Record<string, any> = {
        name: name.trim(),
        group_id: interfaceId, // Required - no null option
        is_admin_only: isAdminOnly,
      }
      
      // Only update base_table if it has changed from the original value
      // Compare current selection (sourceTable) to original (page.base_table)
      const originalBaseTable = page.base_table || ''
      const currentSelection = sourceTable || baseTable || ''
      
      if (currentSelection !== originalBaseTable) {
        // User has changed the selection - update it
        // If currentSelection is empty string, send null to clear it
        updates.base_table = currentSelection || null
      }
      // If unchanged, don't include base_table in updates (preserves existing value)
      
      // Update config with leftPanel configuration based on page type
      const currentConfig = page.config || {}
      const pageType = page.page_type as any
      
      if (pageType === 'record_review' && leftPanelSettings) {
        // Full field list configuration for record_review
        updates.config = {
          ...currentConfig,
          tableId: currentSelection || currentConfig.tableId || currentConfig.primary_table_id,
          leftPanel: leftPanelSettings,
        }
      } else if (pageType === 'record_view' && recordViewSettings) {
        // Simplified 3-field configuration for record_view
        updates.config = {
          ...currentConfig,
          tableId: currentSelection || currentConfig.tableId || currentConfig.primary_table_id,
          leftPanel: recordViewSettings,
          rightPanelFields: rightPanelFields, // Store selected fields for right panel
        }
        
      }
      
      const res = await fetch(`/api/interface-pages/${pageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to update page')
      }

      // Create field blocks for record_view pages after page is saved
      if (pageType === 'record_view' && rightPanelFields.length > 0) {
        const tableId = currentSelection || baseTable || page.base_table
        if (tableId) {
          await createFieldBlocks(pageId, rightPanelFields, tableId)
        }
      }
      
      // Reload page to get updated data
      await loadPage()

      const updatedPage = await res.json()
      onUpdate(updatedPage)
      onClose()
    } catch (error: any) {
      console.error('Error saving page:', error)
      alert(error.message || 'Failed to save page')
    } finally {
      setSaving(false)
    }
  }
  
  // Create field blocks for selected fields
  async function createFieldBlocks(pageId: string, fieldIds: string[], tableId: string | null) {
    if (!tableId) return
    
    try {
      // Get existing blocks to determine starting position
      const blocksResponse = await fetch(`/api/pages/${pageId}/blocks`)
      const blocksData = blocksResponse.ok ? await blocksResponse.json() : { blocks: [] }
      const existingBlocks = blocksData.blocks || []
      
      // Get existing field block field IDs to avoid duplicates
      const existingFieldIds = existingBlocks
        .filter((b: any) => b.type === 'field' && b.config?.field_id)
        .map((b: any) => b.config.field_id)
      
      // Filter out fields that already have blocks
      const fieldsToCreate = fieldIds.filter(id => !existingFieldIds.includes(id))
      
      if (fieldsToCreate.length === 0) {
        return // All fields already have blocks
      }
      
      // Calculate grid layout: 2 columns, 6 wide each (half of 12-column grid)
      const colsPerRow = 2
      const blockWidth = 6 // 6 columns each (half of 12-column grid)
      const blockHeight = 3 // Default height
      const marginY = 1 // Vertical spacing
      
      // Find the maximum Y position to start below existing blocks
      const maxY = existingBlocks.length > 0
        ? Math.max(...existingBlocks.map((b: any) => (b.y || 0) + (b.h || 4)))
        : 0
      
      const startY = maxY + marginY
      
      // Create blocks in grid layout via API
      for (let i = 0; i < fieldsToCreate.length; i++) {
        const fieldId = fieldsToCreate[i]
        const row = Math.floor(i / colsPerRow)
        const col = i % colsPerRow
        
        const x = col * blockWidth
        const y = startY + (row * (blockHeight + marginY))
        
        const response = await fetch(`/api/pages/${pageId}/blocks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'field',
            x,
            y,
            w: blockWidth,
            h: blockHeight,
            config: {
              field_id: fieldId,
              table_id: tableId,
            },
          }),
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || 'Failed to create block')
        }
      }
    } catch (error) {
      console.error('Error creating field blocks:', error)
      // Don't throw - allow page save to complete even if block creation fails
    }
  }

  async function handleDelete() {
    if (!page) return

    setDeleting(true)
    try {
      const res = await fetch(`/api/interface-pages/${pageId}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to delete page')
      }

      // Redirect to home or first available page
      window.location.href = '/'
    } catch (error: any) {
      console.error('Error deleting page:', error)
      alert(error.message || 'Failed to delete page')
    } finally {
      setDeleting(false)
      setShowDeleteDialog(false)
    }
  }

  const pageTypeDef = page ? PAGE_TYPE_DEFINITIONS[page.page_type as keyof typeof PAGE_TYPE_DEFINITIONS] : null

  return (
    <>
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Page Settings</SheetTitle>
            <SheetDescription>
              Configure page settings and data source
            </SheetDescription>
          </SheetHeader>

          {loading ? (
            <div className="p-4">Loading...</div>
          ) : !page ? (
            <div className="p-4 text-red-600">Page not found</div>
          ) : (

          <div className="mt-6 space-y-6">
            {/* Basic Settings */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Page Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter page name"
                />
              </div>

              <div className="space-y-2">
                <Label>Page Type</Label>
                <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                  {pageTypeDef?.label || pageType} - {pageTypeDef?.description || ''}
                </div>
                <p className="text-xs text-gray-500">
                  Page type cannot be changed after creation
                </p>
              </div>

              {/* Source Table (for pages that need data) */}
              {pageTypeDef && (pageTypeDef.requiresSourceView || pageTypeDef.requiresBaseTable) && (
                <div className="space-y-2">
                  <Label htmlFor="sourceTable">Source Table *</Label>
                  <Select
                    value={sourceTable || baseTable}
                    onValueChange={(value) => {
                      setSourceTable(value)
                      setBaseTable(value) // Keep both in sync
                    }}
                  >
                    <SelectTrigger id="sourceTable">
                      <SelectValue placeholder="Select table" />
                    </SelectTrigger>
                    <SelectContent>
                      {tables.map((table) => (
                        <SelectItem key={table.id} value={table.id}>
                          {table.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500">
                    {pageTypeDef?.requiresBaseTable 
                      ? 'Table used for this page'
                      : 'Table that provides data for this page. SQL views are created automatically.'}
                  </p>
                </div>
              )}

              {/* Interface (required) */}
              <div className="space-y-2">
                <Label htmlFor="interface">Interface *</Label>
                <Select
                  value={interfaceId}
                  onValueChange={setInterfaceId}
                  required
                >
                  <SelectTrigger id="interface">
                    <SelectValue placeholder="Select Interface" />
                  </SelectTrigger>
                  <SelectContent>
                    {interfaces.map((iface) => (
                      <SelectItem key={iface.id} value={iface.id}>
                        {iface.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500">
                  Every page must belong to an Interface
                </p>
              </div>

              {/* Admin Only */}
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isAdminOnly"
                  checked={isAdminOnly}
                  onChange={(e) => setIsAdminOnly(e.target.checked)}
                  className="rounded border-gray-300"
                />
                <Label htmlFor="isAdminOnly" className="cursor-pointer">
                  Admin only
                </Label>
              </div>
            </div>

            {/* Record Review Left Panel Settings (full field list) */}
            {pageType === 'record_review' && baseTable && leftPanelSettings !== null && (
              <div className="pt-4 border-t space-y-4">
                <div>
                  <Label className="text-sm font-semibold">Left Panel Fields</Label>
                  <p className="text-xs text-gray-500 mt-1 mb-3">
                    Configure which fields appear in the left column. This is page-level configuration, not block configuration.
                  </p>
                  <RecordReviewLeftPanelSettings
                    tableId={baseTable}
                    currentSettings={leftPanelSettings}
                    onSettingsChange={setLeftPanelSettings}
                  />
                </div>
              </div>
            )}

            {/* Record View Left Panel Settings (simplified: title, subtitle, additional) */}
            {pageType === 'record_view' && baseTable && recordViewSettings !== null && (
              <div className="pt-4 border-t space-y-4">
                <div>
                  <Label className="text-sm font-semibold">Left Panel Fields</Label>
                  <p className="text-xs text-gray-500 mt-1 mb-3">
                    Configure which fields appear in the left column for each record.
                  </p>
                  <RecordViewLeftPanelSettings
                    tableId={baseTable}
                    currentSettings={recordViewSettings}
                    onSettingsChange={setRecordViewSettings}
                  />
                </div>
                
                {/* Right Panel Field Selection */}
                <div className="pt-4 border-t">
                  <Label className="text-sm font-semibold">Right Panel Fields</Label>
                  <p className="text-xs text-gray-500 mt-1 mb-3">
                    Select fields to automatically add as blocks to the right panel. You can reorganize them after adding.
                  </p>
                  
                  {availableFields.length === 0 ? (
                    <p className="text-sm text-gray-500">Loading fields...</p>
                  ) : (
                    <div className="space-y-3">
                      {/* Select All / None buttons */}
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setRightPanelFields(availableFields.map(f => f.id))}
                        >
                          Select All
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setRightPanelFields([])}
                        >
                          Select None
                        </Button>
                      </div>
                      
                      {/* Field checkboxes */}
                      <div className="max-h-64 overflow-y-auto border rounded-md p-3 space-y-2">
                        {availableFields.map((field) => (
                          <label
                            key={field.id}
                            className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 p-2 rounded"
                          >
                            <input
                              type="checkbox"
                              checked={rightPanelFields.includes(field.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setRightPanelFields([...rightPanelFields, field.id])
                                } else {
                                  setRightPanelFields(rightPanelFields.filter(id => id !== field.id))
                                }
                              }}
                              className="rounded"
                            />
                            <span className="text-gray-700">{field.name}</span>
                            <span className="text-xs text-gray-500">({field.type})</span>
                          </label>
                        ))}
                      </div>
                      
                      {rightPanelFields.length > 0 && (
                        <p className="text-xs text-gray-500">
                          {rightPanelFields.length} field{rightPanelFields.length !== 1 ? 's' : ''} selected. 
                          These will be added as blocks when you save.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between pt-4 border-t">
              <Button
                variant="destructive"
                onClick={() => setShowDeleteDialog(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Page
              </Button>

              <div className="flex gap-2">
                <Button variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>
          </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Page</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{name}&quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}


