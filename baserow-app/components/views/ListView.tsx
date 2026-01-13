"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRecordPanel } from "@/contexts/RecordPanelContext"
import { filterRowsBySearch } from "@/lib/search/filterRows"
import { resolveChoiceColor, normalizeHexColor } from '@/lib/field-colors'
import { formatDateUK } from "@/lib/utils"
import type { TableField } from "@/types/fields"
import type { FilterConfig } from "@/lib/interface/filters"
import type { FilterType } from "@/types/database"
import { ChevronDown, ChevronRight, Filter, Group, Plus } from "lucide-react"
import { useIsMobile } from "@/hooks/useResponsive"
import { Button } from "@/components/ui/button"
import GroupDialog from "../grid/GroupDialog"
import FilterDialog from "../grid/FilterDialog"

interface ListViewProps {
  tableId: string
  viewId?: string
  supabaseTableName: string
  tableFields: TableField[]
  filters?: FilterConfig[]
  sorts?: Array<{ field_name: string; direction: 'asc' | 'desc' }>
  groupBy?: string
  searchQuery?: string
  onRecordClick?: (recordId: string) => void
  // List-specific field configuration
  titleField?: string // Required: field name for title
  subtitleFields?: string[] // Optional: up to 3 subtitle fields
  imageField?: string // Optional: field name for image/attachment
  pillFields?: string[] // Optional: select/multi-select fields to show as pills
  metaFields?: string[] // Optional: date, number, etc. for metadata
  // Callbacks for block config updates (when not using views)
  onGroupByChange?: (fieldName: string | null) => void
  onFiltersChange?: (filters: FilterConfig[]) => void
}

export default function ListView({
  tableId,
  viewId,
  supabaseTableName,
  tableFields,
  filters = [],
  sorts = [],
  groupBy,
  searchQuery = "",
  onRecordClick,
  titleField,
  subtitleFields = [],
  imageField,
  pillFields = [],
  metaFields = [],
  onGroupByChange,
  onFiltersChange,
}: ListViewProps) {
  const { openRecord } = useRecordPanel()
  const isMobile = useIsMobile()
  const [rows, setRows] = useState<Record<string, any>[]>([])
  const [loading, setLoading] = useState(true)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [tableName, setTableName] = useState<string | null>(null)
  const [groupDialogOpen, setGroupDialogOpen] = useState(false)
  const [filterDialogOpen, setFilterDialogOpen] = useState(false)
  const [currentGroupBy, setCurrentGroupBy] = useState<string | undefined>(groupBy)
  const [currentFilters, setCurrentFilters] = useState<FilterConfig[]>(filters)

  // Load table name for record panel
  useEffect(() => {
    if (tableId && !tableName) {
      const loadTableName = async () => {
        const supabase = createClient()
        const { data } = await supabase
          .from("tables")
          .select("name, supabase_table")
          .eq("id", tableId)
          .single()
        if (data) {
          setTableName(data.supabase_table)
        }
      }
      loadTableName()
    }
  }, [tableId, tableName])

  // Update currentGroupBy when groupBy prop changes
  useEffect(() => {
    setCurrentGroupBy(groupBy)
  }, [groupBy])

  // Update currentFilters when filters prop changes
  useEffect(() => {
    setCurrentFilters(filters)
  }, [filters])

  // Load rows
  useEffect(() => {
    loadRows()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableId, supabaseTableName, currentFilters, sorts])

  async function loadRows() {
    if (!supabaseTableName) {
      setRows([])
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const supabase = createClient()
      let query = supabase.from(supabaseTableName).select("*")

      // Apply filters
      currentFilters.forEach((filter) => {
        const { field, operator, value } = filter
        switch (operator) {
          case 'equal':
            query = query.eq(field, value)
            break
          case 'not_equal':
            query = query.neq(field, value)
            break
          case 'greater_than':
            query = query.gt(field, value)
            break
          case 'greater_than_or_equal':
            query = query.gte(field, value)
            break
          case 'less_than':
            query = query.lt(field, value)
            break
          case 'less_than_or_equal':
            query = query.lte(field, value)
            break
          case 'contains':
            query = query.ilike(field, `%${value}%`)
            break
          case 'not_contains':
            query = query.not('ilike', field, `%${value}%`)
            break
          case 'is_empty':
            query = query.is(field, null)
            break
          case 'is_not_empty':
            query = query.not(field, 'is', null)
            break
        }
      })

      // Apply sorting
      if (sorts.length > 0) {
        sorts.forEach((sort, index) => {
          if (index === 0) {
            query = query.order(sort.field_name, { ascending: sort.direction === 'asc' })
          } else {
            // Supabase only supports one order() call, so we'd need to sort in memory for multiple sorts
            // For now, just use the first sort
          }
        })
      } else {
        query = query.order('created_at', { ascending: false })
      }

      const { data, error } = await query

      if (error) {
        console.error("Error loading rows:", error)
        setRows([])
      } else {
        setRows(data || [])
      }
    } catch (error) {
      console.error("Error loading rows:", error)
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  // Filter rows by search query
  const filteredRows = useMemo(() => {
    if (!searchQuery || !tableFields.length) return rows

    const fieldIds = tableFields.map(f => f.name)
    return filterRowsBySearch(rows, tableFields, searchQuery, fieldIds)
  }, [rows, tableFields, searchQuery])

  // Group rows if groupBy is set
  const groupedRows = useMemo(() => {
    if (!currentGroupBy) return { ungrouped: filteredRows }

    const groupField = tableFields.find(f => f.name === currentGroupBy || f.id === currentGroupBy)
    if (!groupField) return { ungrouped: filteredRows }

    const groups: Record<string, Record<string, any>[]> = {}

    filteredRows.forEach((row) => {
      const groupValue = row[currentGroupBy] || '(Empty)'
      const groupKey = String(groupValue)
      if (!groups[groupKey]) {
        groups[groupKey] = []
      }
      groups[groupKey].push(row)
    })

    return groups
  }, [filteredRows, currentGroupBy, tableFields])

  // Handle group change
  const handleGroupChange = useCallback(async (fieldName: string | null) => {
    setCurrentGroupBy(fieldName || undefined)
    
    // If callback provided (block config), use it
    if (onGroupByChange) {
      onGroupByChange(fieldName)
      return
    }
    
    // Otherwise, try to save to view config if viewId exists
    if (!viewId) {
      return
    }

    try {
      const supabase = createClient()
      const groupByValue = fieldName || null

      // Update view config
      const { data: viewData } = await supabase
        .from("views")
        .select("config")
        .eq("id", viewId)
        .single()

      if (viewData) {
        const config = (viewData.config as Record<string, any>) || {}
        config.groupBy = groupByValue

        await supabase
          .from("views")
          .update({ config })
          .eq("id", viewId)
      }
    } catch (error) {
      console.error("Error saving group setting:", error)
    }
  }, [viewId, onGroupByChange])

  // Handle filters change
  const handleFiltersChange = useCallback((newFilters: Array<{ id?: string; field_name: string; operator: any; value?: string }>) => {
    const filterConfigs: FilterConfig[] = newFilters.map(f => ({
      field: f.field_name,
      operator: f.operator,
      value: f.value || '',
    }))
    setCurrentFilters(filterConfigs)
    
    // If callback provided (block config), use it
    if (onFiltersChange) {
      onFiltersChange(filterConfigs)
    }
  }, [onFiltersChange])

  // Get visible fields for table display (title, subtitle, pill, meta fields)
  const visibleFieldsForTable = useMemo(() => {
    const fields: TableField[] = []
    
    if (titleField) {
      const field = tableFields.find(f => f.name === titleField || f.id === titleField)
      if (field) fields.push(field)
    }
    
    subtitleFields.forEach(fieldName => {
      const field = tableFields.find(f => f.name === fieldName || f.id === fieldName)
      if (field) fields.push(field)
    })
    
    pillFields.forEach(fieldName => {
      const field = tableFields.find(f => f.name === fieldName || f.id === fieldName)
      if (field) fields.push(field)
    })
    
    metaFields.forEach(fieldName => {
      const field = tableFields.find(f => f.name === fieldName || f.id === fieldName)
      if (field) fields.push(field)
    })
    
    return fields
  }, [tableFields, titleField, subtitleFields, pillFields, metaFields])

  // Helper to get image from image field
  const getImageUrl = useCallback((row: Record<string, any>): string | null => {
    if (!imageField) return null

    const imageValue = row[imageField]
    if (!imageValue) return null

    // Handle attachment field (array of URLs) or URL field (single URL)
    if (Array.isArray(imageValue) && imageValue.length > 0) {
      const firstItem = imageValue[0]
      if (typeof firstItem === 'string') {
        return firstItem
      }
      if (typeof firstItem === 'object' && firstItem.url) {
        return firstItem.url
      }
    }
    if (typeof imageValue === 'string' && (imageValue.startsWith('http') || imageValue.startsWith('/'))) {
      return imageValue
    }

    return null
  }, [imageField])

  // Helper to format field value for display
  const formatFieldValue = useCallback((field: TableField, value: any): string => {
    if (value === null || value === undefined || value === '') {
      return '—'
    }

    switch (field.type) {
      case 'date':
        return formatDateUK(value)
      case 'number':
      case 'percent':
      case 'currency':
        return String(value)
      case 'checkbox':
        return value ? 'Yes' : 'No'
      case 'single_select':
      case 'multi_select':
        if (Array.isArray(value)) {
          return value.join(', ')
        }
        return String(value)
      case 'attachment':
        if (Array.isArray(value)) {
          return `${value.length} file${value.length !== 1 ? 's' : ''}`
        }
        return '—'
      default:
        return String(value)
    }
  }, [])

  // Helper to get pill color
  const getPillColor = useCallback((field: TableField, value: any): string | null => {
    if (field.type !== 'single_select' && field.type !== 'multi_select') {
      return null
    }

    const normalizedValue = String(value).trim()
    return normalizeHexColor(
      resolveChoiceColor(
        normalizedValue,
        field.type,
        field.options,
        field.type === 'single_select'
      )
    )
  }, [])

  // Handle record click
  const handleRecordClick = useCallback((recordId: string) => {
    if (onRecordClick) {
      onRecordClick(recordId)
    } else if (tableId && tableName) {
      openRecord(tableId, recordId, tableName)
    }
  }, [onRecordClick, tableId, tableName, openRecord])

  // Render a list item
  const renderListItem = useCallback((row: Record<string, any>) => {
    const recordId = row.id

    // Get title field
    const titleFieldObj = tableFields.find(f => f.name === titleField || f.id === titleField)
    const title = titleFieldObj ? formatFieldValue(titleFieldObj, row[titleField!]) : 'Untitled'

    // Get image
    const imageUrl = getImageUrl(row)

    // Get subtitle values
    const subtitleValues = subtitleFields
      .slice(0, 3) // Max 3 subtitles
      .map(fieldName => {
        const field = tableFields.find(f => f.name === fieldName || f.id === fieldName)
        if (!field) return null
        return {
          field,
          value: formatFieldValue(field, row[fieldName]),
        }
      })
      .filter(Boolean) as Array<{ field: TableField; value: string }>

    // Get pill values
    const pillValues = pillFields
      .map(fieldName => {
        const field = tableFields.find(f => f.name === fieldName || f.id === fieldName)
        if (!field || (field.type !== 'single_select' && field.type !== 'multi_select')) {
          return null
        }
        const value = row[fieldName]
        if (!value) return null

        const values = Array.isArray(value) ? value : [value]
        return values.map(v => ({
          field,
          value: String(v),
          color: getPillColor(field, v),
        }))
      })
      .filter(Boolean)
      .flat() as Array<{ field: TableField; value: string; color: string | null }>

    // Get meta values
    const metaValues = metaFields
      .map(fieldName => {
        const field = tableFields.find(f => f.name === fieldName || f.id === fieldName)
        if (!field) return null
        return {
          field,
          value: formatFieldValue(field, row[fieldName]),
        }
      })
      .filter(Boolean) as Array<{ field: TableField; value: string }>

    return (
      <div
        key={recordId}
        onClick={() => handleRecordClick(recordId)}
        className="group cursor-pointer border-b border-gray-200 hover:bg-gray-50 active:bg-gray-100 transition-colors touch-manipulation"
      >
        <div className={`flex items-start gap-3 ${isMobile ? 'p-3' : 'p-4'}`}>
          {/* Image */}
          {imageUrl && (
            <div className={`flex-shrink-0 rounded-md overflow-hidden bg-gray-100 ${isMobile ? 'w-12 h-12' : 'w-16 h-16'}`}>
              <img
                src={imageUrl}
                alt=""
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                }}
              />
            </div>
          )}

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Title */}
            <div className={`font-medium text-gray-900 mb-1 group-hover:text-blue-600 transition-colors ${isMobile ? 'text-sm' : 'text-base'} break-words`}>
              {title}
            </div>

            {/* Subtitles */}
            {subtitleValues.length > 0 && (
              <div className={`text-gray-600 space-y-0.5 mb-2 ${isMobile ? 'text-xs' : 'text-sm'}`}>
                {subtitleValues.map(({ field, value }, idx) => (
                  <div key={idx} className="break-words">{value}</div>
                ))}
              </div>
            )}

            {/* Pills and Meta */}
            <div className="flex flex-wrap items-center gap-2 mt-2">
              {/* Pills */}
              {pillValues.map(({ field, value, color }, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                  style={{
                    backgroundColor: color ? `${color}20` : undefined,
                    color: color || undefined,
                    border: color ? `1px solid ${color}40` : undefined,
                  }}
                >
                  {value}
                </span>
              ))}

              {/* Meta */}
              {metaValues.map(({ field, value }, idx) => (
                <span key={idx} className={`text-gray-500 ${isMobile ? 'text-[10px]' : 'text-xs'}`}>
                  {field.name}: {value}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }, [
    tableFields,
    titleField,
    subtitleFields,
    imageField,
    pillFields,
    metaFields,
    getImageUrl,
    formatFieldValue,
    getPillColor,
    handleRecordClick,
  ])

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 text-sm">
        Loading...
      </div>
    )
  }

  // Render grouped or ungrouped
  if (currentGroupBy && Object.keys(groupedRows).length > 0 && 'ungrouped' in groupedRows === false) {
    const groupField = tableFields.find(f => f.name === currentGroupBy || f.id === currentGroupBy)
    const groupValue = currentGroupBy

    return (
      <div className="h-full flex flex-col">
        {/* Toolbar */}
        <div className="flex-shrink-0 flex items-center gap-2 px-4 py-2 border-b bg-white">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setGroupDialogOpen(true)}
            className="h-8"
          >
            <Group className="h-4 w-4 mr-2" />
            Group
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setFilterDialogOpen(true)}
            className="h-8"
          >
            <Filter className="h-4 w-4 mr-2" />
            Filter
            {currentFilters.length > 0 && (
              <span className="ml-2 px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                {currentFilters.length}
              </span>
            )}
          </Button>
        </div>

        {/* Grouped Content */}
        <div className="flex-1 overflow-y-auto">
          {Object.entries(groupedRows).map(([groupKey, groupRows]) => {
            const isCollapsed = collapsedGroups.has(groupKey)
            const groupDisplayValue = groupKey === '(Empty)' ? '(Empty)' : String(groupKey)
            
            // Get group color if it's a select field
            let groupColor: string | null = null
            if (groupField && (groupField.type === 'single_select' || groupField.type === 'multi_select')) {
              groupColor = getPillColor(groupField, groupKey)
            }

            return (
              <div key={groupKey} className="border-b border-gray-200 last:border-b-0">
                {/* Group Header */}
                <div className="flex items-center justify-between px-4 py-2 bg-gray-50 hover:bg-gray-100 transition-colors">
                  <button
                    onClick={() => {
                      setCollapsedGroups((prev) => {
                        const next = new Set(prev)
                        if (next.has(groupKey)) {
                          next.delete(groupKey)
                        } else {
                          next.add(groupKey)
                        }
                        return next
                      })
                    }}
                    className="flex items-center gap-2 text-left flex-1"
                  >
                    {isCollapsed ? (
                      <ChevronRight className="h-4 w-4 text-gray-500" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-gray-500" />
                    )}
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-sm font-medium"
                      style={{
                        backgroundColor: groupColor ? `${groupColor}20` : undefined,
                        color: groupColor || undefined,
                        border: groupColor ? `1px solid ${groupColor}40` : undefined,
                      }}
                    >
                      {groupDisplayValue}
                    </span>
                    <span className="text-sm text-gray-500 ml-2">{groupRows.length}</span>
                  </button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      // TODO: Implement add record functionality
                      console.log('Add content to group:', groupKey)
                    }}
                    className="h-7 text-xs"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add content
                  </Button>
                </div>

                {/* Group Items - Card View (Lists ≠ Tables) */}
                {!isCollapsed && (
                  <div className="bg-white">
                    {groupRows.map((row) => renderListItem(row))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Dialogs */}
        {viewId ? (
          <>
            <GroupDialog
              isOpen={groupDialogOpen}
              onClose={() => setGroupDialogOpen(false)}
              viewId={viewId}
              tableFields={tableFields}
              groupBy={currentGroupBy}
              onGroupChange={handleGroupChange}
            />
            <FilterDialog
              isOpen={filterDialogOpen}
              onClose={() => setFilterDialogOpen(false)}
              viewId={viewId}
              tableFields={tableFields}
              filters={currentFilters.map((f, idx) => ({
                id: `filter-${idx}`,
                field_name: f.field,
                operator: f.operator as FilterType,
                value: f.value,
              }))}
              onFiltersChange={handleFiltersChange}
            />
          </>
        ) : (groupDialogOpen || filterDialogOpen) && (
          // Simple dialog for when there's no viewId
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md">
              <h3 className="text-lg font-semibold mb-2">
                {groupDialogOpen ? 'Grouping Settings' : 'Filter Settings'}
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Configure {groupDialogOpen ? 'grouping' : 'filter'} settings in the block settings panel (Data tab).
              </p>
              <Button onClick={() => {
                setGroupDialogOpen(false)
                setFilterDialogOpen(false)
              }}>Close</Button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // Render ungrouped list
  const rowsToRender = currentGroupBy ? (groupedRows as { ungrouped: Record<string, any>[] }).ungrouped || [] : filteredRows

  if (rowsToRender.length === 0) {
    return (
      <div className="h-full flex flex-col">
        {/* Toolbar */}
        <div className="flex-shrink-0 flex items-center gap-2 px-4 py-2 border-b bg-white">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setGroupDialogOpen(true)}
            className="h-8"
          >
            <Group className="h-4 w-4 mr-2" />
            Group
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setFilterDialogOpen(true)}
            className="h-8"
          >
            <Filter className="h-4 w-4 mr-2" />
            Filter
            {currentFilters.length > 0 && (
              <span className="ml-2 px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                {currentFilters.length}
              </span>
            )}
          </Button>
        </div>
        <div className="flex-1 flex items-center justify-center text-gray-400 text-sm p-4">
          <div className="text-center">
            <p className="mb-2">No records found</p>
            {searchQuery && (
              <p className="text-xs text-gray-400">Try adjusting your search or filters</p>
            )}
          </div>
        </div>
        {/* Dialogs */}
        {viewId ? (
          <>
            <GroupDialog
              isOpen={groupDialogOpen}
              onClose={() => setGroupDialogOpen(false)}
              viewId={viewId}
              tableFields={tableFields}
              groupBy={currentGroupBy}
              onGroupChange={handleGroupChange}
            />
            <FilterDialog
              isOpen={filterDialogOpen}
              onClose={() => setFilterDialogOpen(false)}
              viewId={viewId}
              tableFields={tableFields}
              filters={currentFilters.map((f, idx) => ({
                id: `filter-${idx}`,
                field_name: f.field,
                operator: f.operator as FilterType,
                value: f.value,
              }))}
              onFiltersChange={handleFiltersChange}
            />
          </>
        ) : (groupDialogOpen || filterDialogOpen) && (
          // Simple dialog for when there's no viewId
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md">
              <h3 className="text-lg font-semibold mb-2">
                {groupDialogOpen ? 'Grouping Settings' : 'Filter Settings'}
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Configure {groupDialogOpen ? 'grouping' : 'filter'} settings in the block settings panel (Data tab).
              </p>
              <Button onClick={() => {
                setGroupDialogOpen(false)
                setFilterDialogOpen(false)
              }}>Close</Button>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex-shrink-0 flex items-center gap-2 px-4 py-2 border-b bg-white">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setGroupDialogOpen(true)}
          className="h-8"
        >
          <Group className="h-4 w-4 mr-2" />
          Group
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setFilterDialogOpen(true)}
          className="h-8"
        >
          <Filter className="h-4 w-4 mr-2" />
          Filter
          {currentFilters.length > 0 && (
            <span className="ml-2 px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
              {currentFilters.length}
            </span>
          )}
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {rowsToRender.map((row) => renderListItem(row))}
      </div>
      {/* Dialogs */}
      {viewId ? (
        <>
          <GroupDialog
            isOpen={groupDialogOpen}
            onClose={() => setGroupDialogOpen(false)}
            viewId={viewId}
            tableFields={tableFields}
            groupBy={currentGroupBy}
            onGroupChange={handleGroupChange}
          />
          <FilterDialog
            isOpen={filterDialogOpen}
            onClose={() => setFilterDialogOpen(false)}
            viewId={viewId}
            tableFields={tableFields}
            filters={currentFilters.map((f, idx) => ({
              id: `filter-${idx}`,
              field_name: f.field,
              operator: f.operator,
              value: f.value,
            }))}
            onFiltersChange={handleFiltersChange}
          />
        </>
      ) : (groupDialogOpen || filterDialogOpen) && (
        // Simple dialog for when there's no viewId
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md">
            <h3 className="text-lg font-semibold mb-2">
              {groupDialogOpen ? 'Grouping Settings' : 'Filter Settings'}
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              {groupDialogOpen ? 'Grouping' : 'Filter'} settings require a view to be configured. Please configure a view in the block settings.
            </p>
            <Button onClick={() => {
              setGroupDialogOpen(false)
              setFilterDialogOpen(false)
            }}>Close</Button>
          </div>
        </div>
      )}
    </div>
  )
}
