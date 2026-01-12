"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Plus, X, ArrowUp, ArrowDown, Save, Edit2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import type { InterfacePage } from "@/lib/interface/page-types-only"
import { getPageTypeDefinition, validatePageAnchor, isRecordReviewPage } from "@/lib/interface/page-types"
import RecordViewPageSettings from "./settings/RecordViewPageSettings"

interface PageDisplaySettingsPanelProps {
  page: InterfacePage | null
  isOpen: boolean
  onClose: () => void
  onUpdate: () => void
}

interface ViewFilter {
  id?: string
  field_name: string
  operator: string
  value: string
}

interface ViewSort {
  id?: string
  field_name: string
  direction: 'asc' | 'desc'
  order_index: number
}

interface Table {
  id: string
  name: string
}

interface TableField {
  id: string
  name: string
  type: string
}

export default function PageDisplaySettingsPanel({
  page,
  isOpen,
  onClose,
  onUpdate,
}: PageDisplaySettingsPanelProps) {
  const [tables, setTables] = useState<Table[]>([])
  const [tableFields, setTableFields] = useState<TableField[]>([])
  const [selectedTableId, setSelectedTableId] = useState<string>("")
  const [filters, setFilters] = useState<ViewFilter[]>([])
  const [sorts, setSorts] = useState<ViewSort[]>([])
  const [groupBy, setGroupBy] = useState<string>("")
  const [layout, setLayout] = useState<string>("")
  const [recordPreview, setRecordPreview] = useState<boolean>(true)
  const [density, setDensity] = useState<string>("medium")
  const [readOnly, setReadOnly] = useState<boolean>(false)
  const [defaultFocus, setDefaultFocus] = useState<string>("first")
  const [startDateField, setStartDateField] = useState<string>("")
  const [endDateField, setEndDateField] = useState<string>("")
  const [calendarDisplayFields, setCalendarDisplayFields] = useState<string[]>([])
  const [timelineColorField, setTimelineColorField] = useState<string>("") // Color field for timeline view
  const [previewFields, setPreviewFields] = useState<string[]>([])
  const [detailFields, setDetailFields] = useState<string[]>([])
  const [selectedFieldsForBlocks, setSelectedFieldsForBlocks] = useState<string[]>([]) // Fields selected for blocks
  const [recordReviewGroupBy, setRecordReviewGroupBy] = useState<string>("") // Group field for record review pages
  const [loading, setLoading] = useState(false)
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const [addingFields, setAddingFields] = useState(false)
  const [contentPageName, setContentPageName] = useState(page?.name || "")
  const [savingContentPageName, setSavingContentPageName] = useState(false)

  // Load initial data
  useEffect(() => {
    if (isOpen && page) {
      loadInitialData()
    }
  }, [isOpen, page])

  async function loadInitialData() {
    if (!page) return
    
    // TypeScript guard: page is non-null after the check above
    const currentPage = page

    // UNIFIED: All pages use blocks - settings panel is for page metadata only
    // Block-specific settings are handled in block settings panels
    // Content pages don't need view-specific settings
    if (currentPage.page_type === 'content') {
      return
    }

    // Reset state when panel opens/closes to prevent glitching
    if (!isOpen) {
      setSelectedTableId("")
      setTableFields([])
      setFilters([])
      setSorts([])
      setGroupBy("")
      setLayout("")
      setRecordPreview(true)
      setDensity("medium")
      setReadOnly(false)
      setDefaultFocus("first")
      setStartDateField("")
      setEndDateField("")
      setCalendarDisplayFields([])
      setTimelineColorField("")
      setPreviewFields([])
      setDetailFields([])
      setIsInitialLoad(true)
      return
    }

    setLoading(true)
    try {
      const supabase = createClient()

      // Load tables
      const { data: tablesData } = await supabase
        .from('tables')
        .select('id, name')
        .order('name')
      setTables(tablesData || [])

      // Load page's table from base_table or page config
      // Pages now use blocks, not views - so we get table from base_table or block config
      let tableIdToUse: string | null = null
      
      // Check base_table first (primary source for pages)
      if ((currentPage as any).base_table) {
        const baseTable = (currentPage as any).base_table
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(baseTable)) {
          tableIdToUse = baseTable
        }
      }
      
      // Fallback: Check page config for table_id (from block config)
      if (!tableIdToUse && currentPage.config?.table_id) {
        tableIdToUse = currentPage.config.table_id
      }

      if (tableIdToUse) {
        setSelectedTableId(tableIdToUse)
        const fields = await loadTableFieldsSync(tableIdToUse)
        setTableFields(fields)
        
        // Load grouping field from page config (blocks store config in page.config)
        // UNIFIED: Grouping is handled by blocks
        // Disabled: This code is not used in unified architecture
        if (false) {
          const groupByFromConfig = currentPage.config?.group_by || currentPage.config?.group_by_field || ''
          if (groupByFromConfig) {
            setGroupBy(groupByFromConfig)
          }
        }

        // Load filters from page config (blocks store filters in page.config)
        const filtersFromConfig = currentPage.config?.filters || []
        if (Array.isArray(filtersFromConfig) && filtersFromConfig.length > 0) {
          // Convert block filter format to ViewFilter format for UI
          const configFilters = filtersFromConfig.map((f: any) => ({
            id: f.id || undefined,
            field_name: f.field || f.field_name || '',
            operator: f.operator || 'equal',
            value: f.value || '',
          }))
          setFilters(configFilters)
        } else {
          setFilters([])
        }

        // Load sorts from page config (blocks store sorts in page.config)
        const sortsFromConfig = currentPage.config?.sorts || []
        if (Array.isArray(sortsFromConfig) && sortsFromConfig.length > 0) {
          const configSorts = sortsFromConfig.map((s: any, idx: number) => ({
            id: s.id || undefined,
            field_name: s.field || s.field_name || '',
            direction: (s.direction || 'asc') as 'asc' | 'desc',
            order_index: s.order_index ?? idx,
          }))
          setSorts(configSorts)
        } else {
          setSorts([])
        }
      }

      // Load page config
      const config = currentPage.config || {}
      // CRITICAL: Layout is determined by blocks only, not by page type or visualisation
      // This setting is informational only - it does NOT affect layout
      setLayout(config.visualisation || 'content')
      setRecordPreview(config.record_panel !== 'none')
      setDensity(config.row_height || 'medium')
      setReadOnly(config.read_only || false)
      setDefaultFocus(config.default_focus || 'first')
      
      // Load record review group field from config
      if (currentPage.page_type === 'record_review' && config.group_by_field) {
        setRecordReviewGroupBy(config.group_by_field || '')
      }
      
      // UNIFIED: Blocks handle their own configuration
      // Page config only stores basic metadata
      // Load grouping field from config if present
      if (config.group_by) {
        const groupByFromConfig = config.group_by || ''
        if (groupByFromConfig) {
          setGroupBy(groupByFromConfig)
        }
      }
      
      // Mark initial load as complete
      setIsInitialLoad(false)
    } catch (error) {
      console.error('Error loading initial data:', error)
    } finally {
      setLoading(false)
    }
  }

  async function loadTableFields(tableId: string) {
    try {
      const supabase = createClient()
      const { data: fieldsData } = await supabase
        .from('table_fields')
        .select('id, name, type')
        .eq('table_id', tableId)
        .order('position', { ascending: true })
      setTableFields(fieldsData || [])
      return fieldsData || []
    } catch (error) {
      console.error('Error loading table fields:', error)
      setTableFields([])
      return []
    }
  }

  async function loadTableFieldsSync(tableId: string): Promise<TableField[]> {
    try {
      const supabase = createClient()
      const { data: fieldsData } = await supabase
        .from('table_fields')
        .select('id, name, type')
        .eq('table_id', tableId)
        .order('position', { ascending: true })
      return (fieldsData || []) as TableField[]
    } catch (error) {
      console.error('Error loading table fields:', error)
      return []
    }
  }

  useEffect(() => {
    if (selectedTableId) {
      loadTableFields(selectedTableId)
    } else {
      // Clear fields when no table is selected
      setTableFields([])
    }
  }, [selectedTableId])

  // Determine if page supports grouping (needed before saveSettings callback)
  // CRITICAL: Grouping is determined by blocks, not by page type
  // This check is removed - blocks define behavior, not pages
  const supportsGrouping = false // Always false - blocks handle grouping, not pages

  // Auto-save function - called whenever settings change
  // Pages now use blocks, so we save to page config and update/create blocks
  const saveSettings = useCallback(async () => {
    if (!page) return
    
    // TypeScript guard: page is non-null after the check above
    const currentPage = page

    try {
      const supabase = createClient()

      // Update page's base_table if table is selected
      if (selectedTableId) {
        await supabase
          .from('interface_pages')
          .update({ base_table: selectedTableId })
          .eq('id', currentPage.id)
      }

      // Convert filters and sorts to block format
      const blockFilters = filters
        .filter(f => f.field_name && f.operator)
        .map((f) => ({
          field: f.field_name,
          operator: f.operator,
          value: f.value || '',
        }))

      const blockSorts = sorts
        .filter(s => s.field_name)
        .map((s) => ({
          field: s.field_name,
          direction: s.direction,
          order_index: s.order_index,
        }))

      // Update page config with all settings
      const config = {
        ...currentPage.config,
        table_id: selectedTableId || undefined,
        visualisation: layout,
        record_panel: recordPreview ? 'side' : 'none',
        row_height: density,
        read_only: readOnly,
        default_focus: defaultFocus,
        // Store filters and sorts in block format
        filters: blockFilters,
        sorts: blockSorts,
        // Store grouping field for kanban/list pages
        ...(supportsGrouping && groupBy ? { group_by: groupBy, group_by_field: groupBy } : {}),
        // Store group_by_field for record review pages
        ...(currentPage.page_type === 'record_review' ? { group_by_field: recordReviewGroupBy || undefined } : {}),
        // Store timeline color field
        ...(timelineColorField ? { timeline_color_field: timelineColorField } : {}),
        // UNIFIED: Blocks handle their own view type and configuration
        // Page config only stores basic metadata
      }

      await supabase
        .from('interface_pages')
        .update({ config })
        .eq('id', currentPage.id)

      // Ensure page has a grid block with this config
      // Load existing blocks
      const { data: existingBlocks } = await supabase
        .from('view_blocks')
        .select('*')
        .eq('page_id', currentPage.id)
        .eq('type', 'grid')

      if (existingBlocks && existingBlocks.length > 0) {
        // Update existing grid block
        const gridBlock = existingBlocks[0]
        await supabase
          .from('view_blocks')
          .update({
            config: {
              ...gridBlock.config,
              table_id: selectedTableId,
              view_type: config.view_type,
              filters: blockFilters,
              sorts: blockSorts,
              ...(supportsGrouping && groupBy ? { group_by_field: groupBy } : {}),
              ...(timelineColorField ? { timeline_color_field: timelineColorField } : {}),
              // UNIFIED: Blocks handle their own configuration
            }
          })
          .eq('id', gridBlock.id)
      } else if (selectedTableId) {
        // Create a new grid block for this page
        await supabase
          .from('view_blocks')
          .insert({
            page_id: currentPage.id,
            type: 'grid',
            position_x: 0,
            position_y: 0,
            width: 12,
            height: 12,
            config: {
              table_id: selectedTableId,
              view_type: config.view_type,
              filters: blockFilters,
              sorts: blockSorts,
              ...(supportsGrouping && groupBy ? { group_by_field: groupBy } : {}),
              ...(timelineColorField ? { timeline_color_field: timelineColorField } : {}),
              // UNIFIED: Blocks handle their own configuration
            },
            order_index: 0,
          })
      }

      onUpdate()
      // Refresh data without full page reload
      // The onUpdate callback will trigger a data refresh in the parent component
    } catch (error: any) {
      console.error('Error saving settings:', error)
      alert(error?.message || 'Failed to save settings. Please try again.')
    }
  }, [page, layout, recordPreview, density, readOnly, defaultFocus, filters, sorts, groupBy, recordReviewGroupBy, tableFields, selectedTableId, supportsGrouping, startDateField, endDateField, calendarDisplayFields, timelineColorField, previewFields, detailFields, onUpdate])

  // Reset initial load flag when panel closes
  useEffect(() => {
    if (!isOpen) {
      setIsInitialLoad(true)
    }
  }, [isOpen])

  function addFilter() {
    setFilters([...filters, { field_name: '', operator: 'equal', value: '' }])
  }

  function removeFilter(index: number) {
    setFilters(filters.filter((_, i) => i !== index))
  }

  function updateFilter(index: number, field: keyof ViewFilter, value: string) {
    const updated = [...filters]
    updated[index] = { ...updated[index], [field]: value }
    setFilters(updated)
  }

  function addSort() {
    setSorts([...sorts, { field_name: '', direction: 'asc', order_index: sorts.length }])
  }

  function removeSort(index: number) {
    const updated = sorts.filter((_, i) => i !== index).map((s, idx) => ({
      ...s,
      order_index: idx,
    }))
    setSorts(updated)
  }

  function updateSort(index: number, field: keyof ViewSort, value: string | number) {
    const updated = [...sorts]
    updated[index] = { ...updated[index], [field]: value }
    setSorts(updated)
  }

  function moveSort(index: number, direction: 'up' | 'down') {
    if (direction === 'up' && index === 0) return
    if (direction === 'down' && index === sorts.length - 1) return

    const updated = [...sorts]
    const newIndex = direction === 'up' ? index - 1 : index + 1
    ;[updated[index], updated[newIndex]] = [updated[newIndex], updated[index]]
    updated[index].order_index = index
    updated[newIndex].order_index = newIndex
    setSorts(updated)
  }

  if (!page) return null

  // TypeScript guard: page is non-null after the check above
  const currentPage = page

  // Update content page name when page changes (must be before any early returns)
  useEffect(() => {
    if (page) {
      setContentPageName(page.name)
    }
  }, [page?.name, page])

  if (!page) return null

  // TypeScript guard: page is non-null after the check above
  const currentPage = page

  const pageDefinition = getPageTypeDefinition(currentPage.page_type)
  const isDataBacked = pageDefinition.requiresSourceView || pageDefinition.requiresBaseTable

  // Content pages don't show data settings - they're block-based only
  if (currentPage.page_type === 'content') {
    const handleSaveContentPageName = async () => {
      if (!page || contentPageName.trim() === page.name) return
      
      setSavingContentPageName(true)
      try {
        const res = await fetch(`/api/interface-pages/${page.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: contentPageName.trim() }),
        })

        const data = await res.json()
        
        if (!res.ok) {
          throw new Error(data.error || 'Failed to save page name')
        }

        onUpdate()
        // Trigger sidebar refresh
        window.dispatchEvent(new CustomEvent('pages-updated'))
      } catch (error: any) {
        console.error('Error saving page name:', error)
        alert(error.message || 'Failed to save page name. Please try again.')
        // Revert to original name
        setContentPageName(page.name)
      } finally {
        setSavingContentPageName(false)
      }
    }

    return (
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Page Settings</SheetTitle>
            <SheetDescription>
              Configure settings for this content page
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-6">
            <div className="space-y-2">
              <Label>Page Name</Label>
              <div className="flex gap-2">
                <Input 
                  value={contentPageName} 
                  onChange={(e) => setContentPageName(e.target.value)}
                  onBlur={handleSaveContentPageName}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.currentTarget.blur()
                    } else if (e.key === 'Escape') {
                      setContentPageName(page.name)
                      e.currentTarget.blur()
                    }
                  }}
                  disabled={savingContentPageName}
                  className="flex-1"
                />
                {savingContentPageName && (
                  <span className="text-xs text-gray-400 self-center">Saving...</span>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Page Type</Label>
              <Input value="Content Page" disabled className="bg-gray-50" />
            </div>
            <div className="space-y-2">
              <Label>Interface</Label>
              <Input value={page.group_id || 'N/A'} disabled className="bg-gray-50" />
            </div>
            <p className="text-sm text-gray-500">
              Content Pages are block-based pages for documentation and resources. 
              They don&apos;t require data sources.
            </p>
          </div>
        </SheetContent>
      </Sheet>
    )
  }

  // Show settings panel for data-backed pages (requiresSourceView or requiresBaseTable)
  if (!isDataBacked) {
    return null
  }

  // Record View pages use special page-level settings
  if (isRecordReviewPage(currentPage.page_type)) {
    return (
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Record View Settings</SheetTitle>
            <SheetDescription>
              Configure page-level settings for this Record View. Block-specific settings are configured in the block settings panel.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            <RecordViewPageSettings
              pageId={currentPage.id}
              config={{
                ...(currentPage.config || {}),
                // Ensure table_id/base_table is available from page if not in config
                table_id: (currentPage.config as any)?.table_id || (currentPage.config as any)?.base_table || (currentPage as any)?.base_table || undefined,
                base_table: (currentPage.config as any)?.base_table || (currentPage as any)?.base_table || undefined,
              }}
              tables={tables as any}
              onUpdate={async (updates) => {
                const supabase = createClient()
                const newConfig = {
                  ...(currentPage.config || {}),
                  ...updates,
                }
                await supabase
                  .from('interface_pages')
                  .update({ config: newConfig })
                  .eq('id', currentPage.id)
                
                // Also update base_table if table_id is being set
                if (updates.table_id) {
                  await supabase
                    .from('interface_pages')
                    .update({ base_table: updates.table_id })
                    .eq('id', currentPage.id)
                }
                
                onUpdate()
              }}
              onTableChange={async (tableId) => {
                const supabase = createClient()
                await supabase
                  .from('interface_pages')
                  .update({ base_table: tableId })
                  .eq('id', currentPage.id)
                onUpdate()
              }}
            />
          </div>
        </SheetContent>
      </Sheet>
    )
  }

  // UNIFIED: Layout is handled by blocks, not pages
  // This panel only handles basic page metadata
  const layoutOptions: Array<{ value: string; label: string }> = []

  return (
    <>
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Page Display Settings</SheetTitle>
          <SheetDescription>
            Configure data source, filters, sorting, and display options for this page
          </SheetDescription>
        </SheetHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-sm text-gray-500">Loading...</div>
          </div>
        ) : (
          <Tabs defaultValue="data" className="mt-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="data">Data</TabsTrigger>
              <TabsTrigger value="layout">Layout</TabsTrigger>
              <TabsTrigger value="behaviour">Behaviour</TabsTrigger>
            </TabsList>

            <TabsContent value="data" className="mt-6 space-y-6">
              {/* Data Source */}
              <div className="space-y-2">
                <Label>Data Source</Label>
                <Select
                  value={selectedTableId}
                  onValueChange={setSelectedTableId}
                >
                  <SelectTrigger>
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
              </div>

              {/* Filters */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Filters</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addFilter}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Filter
                  </Button>
                </div>
                <div className="space-y-2">
                  {filters.map((filter, index) => (
                    <div key={index} className="flex gap-2 items-start p-2 border rounded">
                      <div className="flex-1 space-y-2">
                        <Select
                          value={filter.field_name}
                          onValueChange={(value) =>
                            updateFilter(index, 'field_name', value)
                          }
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue placeholder="Field" />
                          </SelectTrigger>
                          <SelectContent>
                            {tableFields.map((field) => (
                              <SelectItem key={field.id} value={field.name}>
                                {field.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select
                          value={filter.operator}
                          onValueChange={(value) =>
                            updateFilter(index, 'operator', value)
                          }
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="equal">Equals</SelectItem>
                            <SelectItem value="not_equal">Not equals</SelectItem>
                            <SelectItem value="contains">Contains</SelectItem>
                            <SelectItem value="not_contains">Not contains</SelectItem>
                            <SelectItem value="is_empty">Is empty</SelectItem>
                            <SelectItem value="is_not_empty">Is not empty</SelectItem>
                            <SelectItem value="greater_than">Greater than</SelectItem>
                            <SelectItem value="less_than">Less than</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input
                          value={filter.value}
                          onChange={(e) =>
                            updateFilter(index, 'value', e.target.value)
                          }
                          placeholder="Value"
                          className="h-8"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFilter(index)}
                        className="h-8 w-8 p-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  {filters.length === 0 && (
                    <div className="text-sm text-gray-500 py-4 text-center">
                      No filters applied
                    </div>
                  )}
                </div>
              </div>

              {/* Timeline Color Field */}
              <div className="space-y-2">
                <Label>Timeline Color Field (Optional)</Label>
                <Select
                  value={timelineColorField || "__none__"}
                  onValueChange={(value) =>
                    setTimelineColorField(value === "__none__" ? "" : value)
                  }
                  disabled={!selectedTableId || tableFields.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select color field" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {tableFields
                      .filter((f) => f.type === "single_select" || f.type === "multi_select")
                      .map((field) => (
                        <SelectItem key={field.id} value={field.name}>
                          {field.name} ({field.type})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500">
                  Use a single-select or multi-select field to color-code timeline records. For multi-select fields, the first value is used.
                </p>
              </div>

              {/* Sorting */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Sorting</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addSort}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Sort
                  </Button>
                </div>
                <div className="space-y-2">
                  {sorts.map((sort, index) => (
                    <div key={index} className="flex gap-2 items-start p-2 border rounded">
                      <div className="flex-1 space-y-2">
                        <Select
                          value={sort.field_name}
                          onValueChange={(value) =>
                            updateSort(index, 'field_name', value)
                          }
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue placeholder="Field" />
                          </SelectTrigger>
                          <SelectContent>
                            {tableFields.map((field) => (
                              <SelectItem key={field.id} value={field.name}>
                                {field.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select
                          value={sort.direction}
                          onValueChange={(value) =>
                            updateSort(index, 'direction', value as 'asc' | 'desc')
                          }
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="asc">Ascending</SelectItem>
                            <SelectItem value="desc">Descending</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex flex-col gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => moveSort(index, 'up')}
                          disabled={index === 0}
                          className="h-8 w-8 p-0"
                        >
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => moveSort(index, 'down')}
                          disabled={index === sorts.length - 1}
                          className="h-8 w-8 p-0"
                        >
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeSort(index)}
                          className="h-8 w-8 p-0"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {sorts.length === 0 && (
                    <div className="text-sm text-gray-500 py-4 text-center">
                      No sorting applied
                    </div>
                  )}
                </div>
              </div>

              {/* Grouping */}
              {supportsGrouping && (
                <div className="space-y-2">
                  <Label>Group By</Label>
                  <Select value={groupBy || "__none__"} onValueChange={(value) => setGroupBy(value === "__none__" ? "" : value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="No grouping" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">No grouping</SelectItem>
                      {tableFields
                        .filter((f) => ['single_select', 'multi_select'].includes(f.type))
                        .map((field) => (
                          <SelectItem key={field.id} value={field.name}>
                            {field.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* UNIFIED: Calendar configuration moved to CalendarBlock */}
              {/* Note: 'calendar' is not a valid PageType - removed invalid comparison */}
              {false && page && (
                <>
                  <div className="space-y-2">
                    <Label>Start Date Field</Label>
                    <Select 
                      value={startDateField || "__none__"} 
                      onValueChange={(value) => setStartDateField(value === "__none__" ? "" : value)}
                      disabled={!selectedTableId || tableFields.length === 0}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select start date field" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {tableFields
                          .filter((f) => f.type === 'date')
                          .map((field) => (
                            <SelectItem key={field.id} value={field.name}>
                              {field.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-500">
                      Select the date field to use for calendar events. Required for calendar view.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>End Date Field (Optional)</Label>
                    <Select 
                      value={endDateField || "__none__"} 
                      onValueChange={(value) => setEndDateField(value === "__none__" ? "" : value)}
                      disabled={!selectedTableId || tableFields.length === 0}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select end date field (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {tableFields
                          .filter((f) => f.type === 'date')
                          .map((field) => (
                            <SelectItem key={field.id} value={field.name}>
                              {field.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-500">
                      Optional: Select an end date field for multi-day events. Leave empty for single-day events.
                    </p>
                  </div>

                  {/* Calendar Display Fields */}
                  <div className="space-y-2">
                    <Label>Fields to Display on Calendar Entries</Label>
                    <p className="text-xs text-gray-500">
                      Choose which fields appear on each calendar entry (in addition to the title)
                    </p>
                    <div className="space-y-2 max-h-[200px] overflow-y-auto border border-gray-200 rounded-md p-2">
                      {tableFields
                        .filter((f) => f.type !== 'date' && f.type !== 'attachment')
                        .map((field) => {
                          const isSelected = calendarDisplayFields.includes(field.name)
                          return (
                            <label
                              key={field.id}
                              className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-1 rounded"
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setCalendarDisplayFields([...calendarDisplayFields, field.name])
                                  } else {
                                    setCalendarDisplayFields(calendarDisplayFields.filter((f) => f !== field.name))
                                  }
                                }}
                                className="rounded border-gray-300"
                                disabled={!selectedTableId || tableFields.length === 0}
                              />
                              <span className="text-sm text-gray-700">{field.name}</span>
                              <span className="text-xs text-gray-400">({field.type})</span>
                            </label>
                          )
                        })}
                    </div>
                    {tableFields.filter((f) => f.type !== 'date' && f.type !== 'attachment').length === 0 && (
                      <p className="text-xs text-gray-400 italic">No fields available to display</p>
                    )}
                  </div>
                </>
              )}
            </TabsContent>

            <TabsContent value="layout" className="mt-6 space-y-6">
              {/* Layout Selector - Hidden for Record Review pages (fixed layout) */}
              {/* UNIFIED: Layout options moved to block settings */}
              {false && currentPage && currentPage.page_type !== 'record_view' && (
                <div className="space-y-2">
                  <Label>Layout</Label>
                  <Select value={layout} onValueChange={setLayout}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {layoutOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              {/* UNIFIED: Record view configuration moved to blocks */}
              {false && currentPage && currentPage.page_type === 'record_view' && (
                <div className="space-y-2">
                  <Label>Layout</Label>
                  <div className="text-sm text-gray-500 p-3 bg-gray-50 rounded-md">
                    Record Review pages use a fixed layout mode. This page shows one record at a time with a detail panel.
                  </div>
                </div>
              )}

              {/* Record Preview */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Record Preview</Label>
                  <div className="text-sm text-gray-500">
                    Show record detail panel
                  </div>
                </div>
                <Switch
                  checked={recordPreview}
                  onCheckedChange={setRecordPreview}
                />
              </div>

              {/* Group By Field - Record Review pages only */}
              {currentPage && currentPage.page_type === 'record_review' && (
                <div className="space-y-2">
                  <Label>Group Records By</Label>
                  <Select
                    value={recordReviewGroupBy || "__none__"}
                    onValueChange={(value) => setRecordReviewGroupBy(value === "__none__" ? "" : value)}
                    disabled={!selectedTableId || tableFields.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a select field to group by" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">No grouping</SelectItem>
                      {tableFields
                        .filter((f) => f.type === 'single_select' || f.type === 'multi_select')
                        .map((field) => (
                          <SelectItem key={field.id} value={field.name}>
                            {field.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500">
                    Group records in the left panel by a select field. Records will be organized by their select field values.
                  </p>
                </div>
              )}

              {/* UNIFIED: Preview fields configuration moved to blocks */}
              {false && currentPage && currentPage.page_type === 'record_view' && (
                <div className="space-y-2">
                  <Label>Preview Fields</Label>
                  <div className="text-sm text-gray-500 mb-2">
                    Select which fields to display in the record list. Leave empty to use default (name and status).
                  </div>
                  {selectedTableId && tableFields.length > 0 ? (
                    <div className="space-y-2 max-h-60 overflow-y-auto border rounded-md p-2">
                      {tableFields.map((field) => {
                        const isSelected = previewFields.includes(field.name)
                        return (
                          <label
                            key={field.id}
                            className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-1 rounded"
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setPreviewFields([...previewFields, field.name])
                                } else {
                                  setPreviewFields(previewFields.filter((f) => f !== field.name))
                                }
                              }}
                              className="rounded border-gray-300"
                            />
                            <span className="text-sm text-gray-700">{field.name}</span>
                            <span className="text-xs text-gray-400">({field.type})</span>
                          </label>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-400 p-3 bg-gray-50 rounded-md">
                      Select a data source to configure preview fields.
                    </div>
                  )}
                </div>
              )}

              {/* Detail Fields - Record Review pages only */}
              {/* UNIFIED: Record review layout moved to block settings */}
              {false && currentPage && currentPage.page_type === 'record_view' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Detail Fields</Label>
                      <div className="text-sm text-gray-500">
                        Select which fields to display in the left detail panel. Leave empty to show all fields.
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const allFieldNames = tableFields.map(f => f.name)
                          setDetailFields(allFieldNames)
                        }}
                        className="text-xs text-blue-600 hover:text-blue-700 underline"
                      >
                        Select All
                      </button>
                      <span className="text-xs text-gray-300">|</span>
                      <button
                        type="button"
                        onClick={() => setDetailFields([])}
                        className="text-xs text-blue-600 hover:text-blue-700 underline"
                      >
                        Select None
                      </button>
                    </div>
                  </div>
                  {selectedTableId && tableFields.length > 0 ? (
                    <div className="space-y-2 max-h-60 overflow-y-auto border rounded-md p-2">
                      {tableFields.map((field) => {
                        const isSelected = detailFields.includes(field.name)
                        return (
                          <label
                            key={field.id}
                            className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-1 rounded"
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setDetailFields([...detailFields, field.name])
                                } else {
                                  setDetailFields(detailFields.filter((f) => f !== field.name))
                                }
                              }}
                              className="rounded border-gray-300"
                            />
                            <span className="text-sm text-gray-700">{field.name}</span>
                            <span className="text-xs text-gray-400">({field.type})</span>
                          </label>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-400 p-3 bg-gray-50 rounded-md">
                      Select a data source to configure detail fields.
                    </div>
                  )}
                  <p className="text-xs text-gray-500">
                    {detailFields.length} of {tableFields.length} fields selected
                  </p>
                </div>
              )}


              {/* Density */}
              <div className="space-y-2">
                <Label>Density</Label>
                <Select value={density} onValueChange={setDensity}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="compact">Compact</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="comfortable">Comfortable</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>

            <TabsContent value="behaviour" className="mt-6 space-y-6">
              {/* Read-only */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Read-only</Label>
                  <div className="text-sm text-gray-500">
                    Prevent editing records
                  </div>
                </div>
                <Switch checked={readOnly} onCheckedChange={setReadOnly} />
              </div>

              {/* Default Focus */}
              <div className="space-y-2">
                <Label>Default Focus</Label>
                <Select value={defaultFocus} onValueChange={setDefaultFocus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="first">First record</SelectItem>
                    <SelectItem value="last">Last record</SelectItem>
                    <SelectItem value="none">No focus</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>
          </Tabs>
        )}

        {/* Save Button */}
        <div className="mt-6 pt-4 border-t flex justify-end">
          <Button onClick={() => saveSettings()} className="min-w-[100px]">
            <Save className="h-4 w-4 mr-2" />
            Save
          </Button>
        </div>
      </SheetContent>
      </Sheet>

    </>
  )
}

