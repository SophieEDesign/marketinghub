"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Sheet,
  SheetContent,
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

      // Load page's saved view and its data
      // For calendar and record_review pages, also check base_table if no saved_view_id
      let tableIdToUse: string | null = null
      
      if (page.saved_view_id) {
        const { data: view } = await supabase
          .from('views')
          .select('table_id, config')
          .eq('id', page.saved_view_id)
          .single()

        if (view?.table_id) {
          tableIdToUse = view.table_id
        }
      } else if ((page.page_type === 'calendar' || page.page_type === 'record_review') && (page as any).base_table) {
        // For calendar and record_review pages without a view, use base_table
        // Check if base_table is a UUID (table ID) or needs lookup
        const baseTable = (page as any).base_table
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(baseTable)) {
          tableIdToUse = baseTable
        }
      }

      if (tableIdToUse) {
        setSelectedTableId(tableIdToUse)
        const fields = await loadTableFieldsSync(tableIdToUse)
        setTableFields(fields)
        
        // Load grouping field from config or grid_view_settings for kanban/list pages
        if (supportsGroupingCheck) {
          const groupByFromConfig = page.config?.group_by || ''
          if (groupByFromConfig) {
            setGroupBy(groupByFromConfig)
          } else {
            // Try loading from grid_view_settings
            try {
              const { data: gridSettings } = await supabase
                .from('grid_view_settings')
                .select('group_by_field')
                .eq('view_id', page.saved_view_id)
                .maybeSingle()
              
              if (gridSettings?.group_by_field) {
                setGroupBy(gridSettings.group_by_field)
              }
            } catch (error) {
              // grid_view_settings might not exist, ignore
            }
          }
        }

        // Load filters - need to map field_id to field name
        // Only load if we have a saved_view_id
        if (page.saved_view_id) {
          const { data: filtersData } = await supabase
            .from('view_filters')
            .select('*')
            .eq('view_id', page.saved_view_id)
        
          // Map field_id to field name
          const filtersWithNames = (filtersData || []).map((f: any) => {
            let fieldName = f.field_name
            if (!fieldName && f.field_id) {
              // Look up field name from field_id
              const field = fields.find((tf) => tf.id === f.field_id)
              fieldName = field?.name || f.field_id
            }
            return {
              id: f.id,
              field_name: fieldName || '',
              operator: f.operator || f.filter_type || 'equal',
              value: f.value || '',
            }
          })
          setFilters(filtersWithNames)
        } else {
          // No view, so no filters from view
          setFilters([])
        }

        // Load sorts - need to map field_id to field name
        // Handle errors gracefully (view might not exist or table might not exist)
        // Only load if we have a saved_view_id
        if (page.saved_view_id) {
          try {
            const { data: sortsData, error: sortsError } = await supabase
              .from('view_sorts')
              .select('*')
              .eq('view_id', page.saved_view_id)
          
            if (sortsError) {
              // If order_index column doesn't exist, try without ordering
              if (sortsError.code === '42703' || sortsError.message?.includes('order_index')) {
                const { data: sortsWithoutOrder } = await supabase
                  .from('view_sorts')
                  .select('*')
                  .eq('view_id', page.saved_view_id)
                
                if (sortsWithoutOrder) {
                  const sortsWithNames = sortsWithoutOrder.map((s: any, idx: number) => {
                    let fieldName = s.field_name
                    if (!fieldName && s.field_id) {
                      const field = fields.find((tf) => tf.id === s.field_id)
                      fieldName = field?.name || s.field_id
                    }
                    return {
                      id: s.id,
                      field_name: fieldName || '',
                      direction: (s.direction || s.order_direction || 'asc') as 'asc' | 'desc',
                      order_index: idx,
                    }
                  })
                  setSorts(sortsWithNames)
                }
              } else {
                console.warn('Error loading view sorts:', sortsError)
                setSorts([])
              }
            } else if (sortsData) {
              // Sort client-side if order_index exists
              const sorted = [...sortsData].sort((a, b) => (a.order_index || 0) - (b.order_index || 0))
              const sortsWithNames = sorted.map((s: any, idx: number) => {
                let fieldName = s.field_name
                if (!fieldName && s.field_id) {
                  const field = fields.find((tf) => tf.id === s.field_id)
                  fieldName = field?.name || s.field_id
                }
                return {
                  id: s.id,
                  field_name: fieldName || '',
                  direction: (s.direction || s.order_direction || 'asc') as 'asc' | 'desc',
                  order_index: s.order_index ?? idx,
                }
              })
              setSorts(sortsWithNames)
            }
          } catch (error) {
            console.warn('Error loading view sorts:', error)
            setSorts([])
          }
        } else {
          // No view, so no sorts from view
          setSorts([])
        }

        // Load grouping from grid_view_settings
        // Handle errors gracefully (table might not exist)
        // Only load if we have a saved_view_id
        if (page.saved_view_id) {
          try {
            const { data: gridSettings, error: gridError } = await supabase
              .from('grid_view_settings')
              .select('group_by_field')
              .eq('view_id', page.saved_view_id)
              .maybeSingle()
          
            if (gridError) {
              // If table doesn't exist, skip silently
              if (gridError.code === 'PGRST205' || gridError.code === '42P01') {
                console.warn('grid_view_settings table does not exist. Skipping group_by load.')
              } else {
                console.warn('Error loading grid_view_settings:', gridError)
              }
            } else if (gridSettings?.group_by_field) {
              setGroupBy(gridSettings.group_by_field)
            }
          } catch (error) {
            console.warn('Error loading grid_view_settings:', error)
          }
        }
      }

      // Load page config
      const config = page.config || {}
      setLayout(config.visualisation || page.page_type)
      setRecordPreview(config.record_panel !== 'none')
      setDensity(config.row_height || 'medium')
      setReadOnly(config.read_only || false)
      setDefaultFocus(config.default_focus || 'first')
      
      // Load calendar date fields from config
      if (page.page_type === 'calendar') {
        setStartDateField(config.start_date_field || config.calendar_date_field || '')
        setEndDateField(config.end_date_field || config.calendar_end_field || '')
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
    }
  }, [selectedTableId])

  // Determine if page supports grouping (needed before saveSettings callback)
  const supportsGrouping = ['list', 'kanban'].includes(page?.page_type || '')

  // Auto-save function - called whenever settings change
  const saveSettings = useCallback(async () => {
    if (!page) return

    try {
      const supabase = createClient()

      // If a table is selected but no view exists, create one
      let viewId = page.saved_view_id
      if (selectedTableId && !viewId) {
        // Create a new view for this page
        const { data: newView, error: viewError } = await supabase
          .from('views')
          .insert({
            table_id: selectedTableId,
            name: `${page.name} View`,
            type: page.page_type === 'kanban' ? 'kanban' : page.page_type === 'calendar' ? 'calendar' : 'grid',
          })
          .select()
          .single()

        if (viewError) {
          console.error('Error creating view:', viewError)
          alert('Failed to create view. Please try again.')
          return
        }

        viewId = newView.id

        // Update page with new view ID
        await supabase
          .from('interface_pages')
          .update({ saved_view_id: viewId })
          .eq('id', page.id)
      }

      // If table changed, update the view's table_id
      if (selectedTableId && viewId) {
        const { data: existingView } = await supabase
          .from('views')
          .select('table_id')
          .eq('id', viewId)
          .single()

        if (existingView?.table_id !== selectedTableId) {
          await supabase
            .from('views')
            .update({ table_id: selectedTableId })
            .eq('id', viewId)
        }
      }

      // Update page config
      const config = {
        ...page.config,
        visualisation: layout,
        record_panel: recordPreview ? 'side' : 'none',
        row_height: density,
        read_only: readOnly,
        default_focus: defaultFocus,
        // Store grouping field for kanban/list pages
        ...(supportsGrouping && groupBy ? { group_by: groupBy } : {}),
        // Store calendar date fields for calendar pages
        ...(page.page_type === 'calendar' ? {
          start_date_field: startDateField || undefined,
          end_date_field: endDateField || undefined,
          // Also set calendar_date_field for backward compatibility
          calendar_date_field: startDateField || undefined,
          calendar_start_field: startDateField || undefined,
          calendar_end_field: endDateField || undefined,
        } : {}),
      }
      
      // Also update base_table if table is selected (for calendar pages)
      if (selectedTableId && page.page_type === 'calendar') {
        await supabase
          .from('interface_pages')
          .update({ base_table: selectedTableId })
          .eq('id', page.id)
      }

      await supabase
        .from('interface_pages')
        .update({ config })
        .eq('id', page.id)

      // Update view filters and sorts if saved_view_id exists
      if (viewId) {
        // Delete existing filters and sorts
        await supabase
          .from('view_filters')
          .delete()
          .eq('view_id', viewId)

        await supabase
          .from('view_sorts')
          .delete()
          .eq('view_id', viewId)

        // Insert new filters - map field names to field IDs
        if (filters.length > 0) {
          const filtersToInsert = await Promise.all(
            filters.map(async (f) => {
              // Find field ID from field name
              const field = tableFields.find((tf) => tf.name === f.field_name)
              return {
                view_id: viewId,
                field_id: field?.id || f.field_name, // Fallback to name if ID not found
                filter_type: f.operator,
                value: f.value,
              }
            })
          )
          await supabase
            .from('view_filters')
            .insert(filtersToInsert)
        }

        // Insert new sorts - map field names to field IDs
        if (sorts.length > 0) {
          const sortsToInsert = await Promise.all(
            sorts.map(async (s) => {
              // Find field ID from field name
              const field = tableFields.find((tf) => tf.name === s.field_name)
              return {
                view_id: viewId,
                field_id: field?.id || s.field_name, // Fallback to name if ID not found
                order_direction: s.direction,
                order_index: s.order_index,
              }
            })
          )
          await supabase
            .from('view_sorts')
            .insert(sortsToInsert)
        }

        // Update grouping in grid_view_settings (for kanban/list pages)
        if (supportsGrouping && groupBy) {
          const { data: existing } = await supabase
            .from('grid_view_settings')
            .select('id')
            .eq('view_id', viewId)
            .maybeSingle()

          if (existing) {
            await supabase
              .from('grid_view_settings')
              .update({ group_by_field: groupBy })
              .eq('view_id', viewId)
          } else {
            await supabase
              .from('grid_view_settings')
              .insert({
                view_id: viewId,
                group_by_field: groupBy,
              })
          }
        } else if (supportsGrouping && !groupBy && viewId) {
          // Remove grouping if cleared
          await supabase
            .from('grid_view_settings')
            .update({ group_by_field: null })
            .eq('view_id', viewId)
        }
      }

      onUpdate()
    } catch (error: any) {
      console.error('Error saving settings:', error)
      alert(error?.message || 'Failed to save settings. Please try again.')
    }
  }, [page, layout, recordPreview, density, readOnly, defaultFocus, filters, sorts, groupBy, tableFields, selectedTableId, supportsGrouping, onUpdate])

  // Auto-save on changes with debounce (skip initial load)
  useEffect(() => {
    if (!isOpen || !page || isInitialLoad || loading) return

    const timeoutId = setTimeout(() => {
      saveSettings()
    }, 500) // 500ms debounce

    return () => clearTimeout(timeoutId)
  }, [isOpen, page, layout, recordPreview, density, readOnly, defaultFocus, filters, sorts, groupBy, startDateField, endDateField, selectedTableId, saveSettings, isInitialLoad, loading])

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
                </>
              )}
            </TabsContent>

            <TabsContent value="layout" className="mt-6 space-y-6">
              {/* Layout Selector */}
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

