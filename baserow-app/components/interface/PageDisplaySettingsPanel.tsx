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
import { Plus, X, ArrowUp, ArrowDown, Save } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import type { InterfacePage } from "@/lib/interface/page-types-only"
import { getPageTypeDefinition, validatePageAnchor } from "@/lib/interface/page-types"

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
  const [previewFields, setPreviewFields] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [isInitialLoad, setIsInitialLoad] = useState(true)

  // Load initial data
  useEffect(() => {
    if (isOpen && page) {
      loadInitialData()
    }
  }, [isOpen, page])

  async function loadInitialData() {
    if (!page) return

    // Don't load settings for dashboard/overview/content pages - they use block editing
    if (page.page_type === 'dashboard' || page.page_type === 'overview' || page.page_type === 'content') {
      return
    }
    
    // Check if page supports grouping (for kanban/list pages)
    const supportsGroupingCheck = ['list', 'kanban'].includes(page.page_type || '')

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
      setPreviewFields([])
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
      if ((page as any).base_table) {
        const baseTable = (page as any).base_table
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(baseTable)) {
          tableIdToUse = baseTable
        }
      }
      
      // Fallback: Check page config for table_id (from block config)
      if (!tableIdToUse && page.config?.table_id) {
        tableIdToUse = page.config.table_id
      }

      if (tableIdToUse) {
        setSelectedTableId(tableIdToUse)
        const fields = await loadTableFieldsSync(tableIdToUse)
        setTableFields(fields)
        
        // Load grouping field from page config (blocks store config in page.config)
        if (supportsGroupingCheck) {
          const groupByFromConfig = page.config?.group_by || page.config?.group_by_field || ''
          if (groupByFromConfig) {
            setGroupBy(groupByFromConfig)
          }
        }

        // Load filters from page config (blocks store filters in page.config)
        const filtersFromConfig = page.config?.filters || []
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
        const sortsFromConfig = page.config?.sorts || []
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
      const config = page.config || {}
      setLayout(config.visualisation || page.page_type)
      setRecordPreview(config.record_panel !== 'none')
      setDensity(config.row_height || 'medium')
      setReadOnly(config.read_only || false)
      setDefaultFocus(config.default_focus || 'first')
      
      // Load calendar date fields from page config (blocks store config in page.config)
      if (page.page_type === 'calendar') {
        const startField = config.start_date_field || config.calendar_date_field || config.calendar_start_field || ''
        const endField = config.end_date_field || config.calendar_end_field || ''
        setStartDateField(startField)
        setEndDateField(endField)
        // Load calendar display fields
        const displayFields = config.calendar_display_fields || []
        setCalendarDisplayFields(Array.isArray(displayFields) ? displayFields : [])
      }
      
      // Load preview fields for record_review pages
      if (page.page_type === 'record_review') {
        const previewFieldsFromConfig = config.preview_fields || []
        setPreviewFields(Array.isArray(previewFieldsFromConfig) ? previewFieldsFromConfig : [])
      }
      
      // Load grouping field from config or grid_view_settings
      if (supportsGroupingCheck) {
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
  const supportsGrouping = ['list', 'kanban'].includes(page?.page_type || '')

  // Auto-save function - called whenever settings change
  // Pages now use blocks, so we save to page config and update/create blocks
  const saveSettings = useCallback(async () => {
    if (!page) return

    try {
      const supabase = createClient()

      // Update page's base_table if table is selected
      if (selectedTableId) {
        await supabase
          .from('interface_pages')
          .update({ base_table: selectedTableId })
          .eq('id', page.id)
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
        ...page.config,
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
        // Store calendar date fields for calendar pages
        ...(page.page_type === 'calendar' ? {
          start_date_field: startDateField || undefined,
          end_date_field: endDateField || undefined,
          calendar_date_field: startDateField || undefined,
          calendar_start_field: startDateField || undefined,
          calendar_end_field: endDateField || undefined,
          calendar_display_fields: calendarDisplayFields.length > 0 ? calendarDisplayFields : undefined,
        } : {}),
        // Store preview fields for record_review pages
        ...(page.page_type === 'record_review' ? {
          preview_fields: previewFields.length > 0 ? previewFields : undefined,
        } : {}),
        // Store view type for the block
        view_type: page.page_type === 'list' ? 'grid' : page.page_type,
      }

      await supabase
        .from('interface_pages')
        .update({ config })
        .eq('id', page.id)

      // Ensure page has a grid block with this config
      // Load existing blocks
      const { data: existingBlocks } = await supabase
        .from('view_blocks')
        .select('*')
        .eq('page_id', page.id)
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
              ...(page.page_type === 'calendar' ? {
                calendar_date_field: startDateField,
                calendar_start_field: startDateField,
                calendar_end_field: endDateField,
                calendar_display_fields: calendarDisplayFields.length > 0 ? calendarDisplayFields : undefined,
              } : {}),
              ...(page.page_type === 'record_review' ? {
                preview_fields: previewFields.length > 0 ? previewFields : undefined,
              } : {}),
            }
          })
          .eq('id', gridBlock.id)
      } else if (selectedTableId) {
        // Create a new grid block for this page
        await supabase
          .from('view_blocks')
          .insert({
            page_id: page.id,
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
              ...(page.page_type === 'calendar' ? {
                calendar_date_field: startDateField,
                calendar_start_field: startDateField,
                calendar_end_field: endDateField,
                calendar_display_fields: calendarDisplayFields.length > 0 ? calendarDisplayFields : undefined,
              } : {}),
              ...(page.page_type === 'record_review' ? {
                preview_fields: previewFields.length > 0 ? previewFields : undefined,
              } : {}),
            },
            order_index: 0,
          })
      }

      onUpdate()
    } catch (error: any) {
      console.error('Error saving settings:', error)
      alert(error?.message || 'Failed to save settings. Please try again.')
    }
  }, [page, layout, recordPreview, density, readOnly, defaultFocus, filters, sorts, groupBy, tableFields, selectedTableId, supportsGrouping, startDateField, endDateField, calendarDisplayFields, previewFields, onUpdate])

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

  const pageDefinition = getPageTypeDefinition(page.page_type)
  const isDataBacked = pageDefinition.requiresSourceView || pageDefinition.requiresBaseTable
  
  // Content pages don't show data settings - they're block-based only
  if (page.page_type === 'content') {
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
              <Input value={page.name} disabled className="bg-gray-50" />
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

  const layoutOptions = [
    { value: 'list', label: 'List' },
    { value: 'grid', label: 'Grid' },
    { value: 'calendar', label: 'Calendar' },
    { value: 'kanban', label: 'Kanban' },
    { value: 'gallery', label: 'Gallery' },
    { value: 'record_review', label: 'Record Review' },
  ].filter((opt) => {
    // Filter based on page type capabilities
    if (page.page_type === 'list') {
      return ['list', 'grid'].includes(opt.value)
    }
    if (page.page_type === 'calendar') {
      return opt.value === 'calendar'
    }
    if (page.page_type === 'kanban') {
      return opt.value === 'kanban'
    }
    if (page.page_type === 'gallery') {
      return opt.value === 'gallery'
    }
    if (page.page_type === 'record_review') {
      return opt.value === 'record_review'
    }
    return true
  })

  return (
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

              {/* Calendar Date Fields */}
              {page.page_type === 'calendar' && (
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
              {page.page_type !== 'record_review' && (
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
              
              {/* Record Review pages have fixed layout - show info message */}
              {page.page_type === 'record_review' && (
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

              {/* Preview Fields - Record Review pages only */}
              {page.page_type === 'record_review' && (
                <div className="space-y-2">
                  <Label>Preview Fields</Label>
                  <div className="text-sm text-gray-500 mb-2">
                    Select which fields to display in the left preview panel. Leave empty to use default (name and status).
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
  )
}

