'use client'

/**
 * Record Review View Component
 * Master-detail layout: Left column shows record list with search/filters, right panel shows blocks for selected record
 * 
 * NOTE: This component renders a complete layout (not just a wrapper).
 * Future consideration: Could this layout be migrated to blocks?
 * However, this is often quietly depended on - do not rush migration.
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import { Search, Filter, List, Plus, ChevronDown, MessageSquare, Edit2, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import type { InterfacePage } from '@/lib/interface/page-types-only'
import type { PageBlock } from '@/lib/interface/types'
import type { TableField } from '@/types/fields'
import InterfaceBuilder from './InterfaceBuilder'
import { useBlockEditMode } from '@/contexts/EditModeContext'
import { applySearchToFilters, type FilterConfig } from '@/lib/interface/filters'
import RecordFields from '@/components/records/RecordFields'
import { useToast } from '@/components/ui/use-toast'
import { debugLog, debugWarn, debugError, isDebugEnabled } from '@/lib/interface/debug-flags'

interface RecordReviewViewProps {
  page: InterfacePage
  data: any[]
  config: any
  blocks?: PageBlock[]
  pageTableId: string | null // Table ID from the page
  isLoading?: boolean // Loading state for data
}

export default function RecordReviewView({ page, data, config, blocks = [], pageTableId, isLoading = false }: RecordReviewViewProps) {
  const recordDebugEnabled = isDebugEnabled('RECORD')
  
  // DEBUG_RECORD: Log component mount
  useEffect(() => {
    debugLog('RECORD', 'RecordReviewView MOUNT', {
      pageId: page.id,
      pageName: page.name,
      pageType: page.page_type,
      dataLength: data.length,
      blocksLength: blocks.length,
      pageTableId,
      isLoading,
      config: {
        allow_editing: config.allow_editing,
        record_panel: config.record_panel,
        visible_columns: config.visible_columns,
        preview_fields: config.preview_fields,
        filters: config.filters,
      },
    })
  }, []) // Only on mount
  
  // DEBUG_RECORD: Log data changes
  useEffect(() => {
    if (recordDebugEnabled || process.env.NODE_ENV === 'development') {
      debugLog('RECORD', 'Data changed', {
        dataLength: data.length,
        firstRecord: data[0] ? Object.keys(data[0]) : null,
        isLoading,
      })
    }
  }, [data.length, isLoading, recordDebugEnabled])
  
  // DEBUG_RECORD: Log blocks changes
  useEffect(() => {
    if (recordDebugEnabled || process.env.NODE_ENV === 'development') {
      debugLog('RECORD', 'Blocks changed', {
        blocksLength: blocks.length,
        blockIds: blocks.map((b: PageBlock) => b.id),
        blockTypes: blocks.map((b: PageBlock) => b.type),
      })
    }
  }, [blocks.length, recordDebugEnabled])
  
  // Initialize with first record ID if data is available on mount
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(() => {
    // If data is available on mount, select first record immediately
    if (data && data.length > 0 && data[0]?.id) {
      return data[0].id
    }
    return null
  })
  const [loadedBlocks, setLoadedBlocks] = useState<PageBlock[]>(blocks)
  const [blocksLoading, setBlocksLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filters, setFilters] = useState<FilterConfig[]>(config.filters || [])
  const [tableFields, setTableFields] = useState<TableField[]>([])
  const [fieldGroups, setFieldGroups] = useState<Record<string, string[]>>({})
  const [formData, setFormData] = useState<Record<string, any>>({})
  const [recordListCollapsed, setRecordListCollapsed] = useState(false)
  const { isEditing, enter: enterBlockEdit, exit: exitBlockEdit } = useBlockEditMode(page.id)
  const { toast } = useToast()
  
  const allowEditing = config.allow_editing || false
  const recordPanel = config.record_panel || 'side'
  const [showComments, setShowComments] = useState(true)

  // Get columns from config or data - ensure it's always an array
  const columns = useMemo(() => {
    if (Array.isArray(config.visible_columns) && config.visible_columns.length > 0) {
      return config.visible_columns
    }
    if (data.length > 0 && data[0]) {
      return Object.keys(data[0]).filter(key => key !== '__typename') // Filter out GraphQL fields
    }
    return []
  }, [config.visible_columns, data])
  
  // Create field name mapping (field ID/name -> display name)
  const fieldNameMap = useMemo(() => {
    const map: Record<string, string> = {}
    tableFields.forEach((field) => {
      // Map by field name (which is the column name in the data)
      map[field.name] = field.name
      // Also map by field ID (UUID) to field name
      map[field.id] = field.name
    })
    return map
  }, [tableFields])
  
  // Helper function to get display name for a field
  const getFieldDisplayName = (fieldIdOrName: string): string => {
    // First try the mapping
    if (fieldNameMap[fieldIdOrName]) {
      return fieldNameMap[fieldIdOrName]
    }
    // If not found, try to find by matching field name (case-insensitive)
    const matchedField = tableFields.find(
      (f) => f.name.toLowerCase() === fieldIdOrName.toLowerCase() || f.id === fieldIdOrName
    )
    if (matchedField) {
      return matchedField.name
    }
    // Fallback: return the original value, but format it nicely if it's a UUID
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(fieldIdOrName)) {
      // It's a UUID, try to find the field
      const fieldById = tableFields.find((f) => f.id === fieldIdOrName)
      return fieldById?.name || fieldIdOrName
    }
    // Otherwise return as-is (might already be a readable name)
    return fieldIdOrName
  }
  
  // Get preview fields from config, or fallback to auto-detection
  const previewFields = useMemo(() => {
    if (config.preview_fields && Array.isArray(config.preview_fields) && config.preview_fields.length > 0) {
      // Use configured preview fields
      return config.preview_fields
    }
    // Fallback: auto-detect name and status fields
    const nameField = columns.find((col: string) => 
      col.toLowerCase().includes('name') || 
      col.toLowerCase().includes('title') ||
      col.toLowerCase() === 'id'
    ) || columns[0]
    
    const statusField = columns.find((col: string) => 
      col.toLowerCase().includes('status') || 
      col.toLowerCase() === 'state' ||
      col.toLowerCase() === 'stage'
    )
    
    return statusField ? [nameField, statusField] : [nameField]
  }, [config.preview_fields, columns])
  
  // Get group field for grouping - use config.group_by_field if set
  const groupField = useMemo(() => {
    // Only use configured group_by_field from config (must be a select field)
    if (config.group_by_field) {
      const configuredField = tableFields.find(f => 
        (f.name === config.group_by_field || f.id === config.group_by_field) && 
        (f.type === 'single_select' || f.type === 'multi_select')
      )
      if (configuredField) {
        return configuredField.name
      }
    }
    
    // If no group field configured, return null (no grouping)
    return null
  }, [config.group_by_field, tableFields])
  
  // Keep statusField for backward compatibility (used in display)
  const statusField = columns.find((col: string) => 
    col.toLowerCase().includes('status') || 
    col.toLowerCase() === 'state' ||
    col.toLowerCase() === 'stage'
  ) || columns[0] // Fallback to first column
  
  // Get name/title field (for fallback display)
  const nameField = columns.find((col: string) => 
    col.toLowerCase().includes('name') || 
    col.toLowerCase().includes('title') ||
    col.toLowerCase() === 'id'
  ) || columns[0] // Fallback to first column
  
  // Filter data based on search and filters
  const filteredData = useMemo(() => {
    let result = [...data]

    // Apply search query
    if (searchQuery.trim()) {
      const searchLower = searchQuery.toLowerCase()
      result = result.filter((record) => {
        return columns.some((col: string) => {
          const value = record[col]
          if (value === null || value === undefined) return false
          return String(value).toLowerCase().includes(searchLower)
        })
      })
    }

    // Apply filters
    if (filters.length > 0) {
      result = result.filter((record) => {
        return filters.every((filter) => {
          const fieldValue = record[filter.field]
          switch (filter.operator) {
            case 'equal':
              return fieldValue === filter.value
            case 'not_equal':
              return fieldValue !== filter.value
            case 'contains':
              return String(fieldValue || '').toLowerCase().includes(String(filter.value || '').toLowerCase())
            case 'greater_than':
              return Number(fieldValue) > Number(filter.value)
            case 'less_than':
              return Number(fieldValue) < Number(filter.value)
            case 'is_empty':
              return fieldValue === null || fieldValue === undefined || fieldValue === ''
            case 'is_not_empty':
              return fieldValue !== null && fieldValue !== undefined && fieldValue !== ''
            default:
              return true
          }
        })
      })
    }

    return result
  }, [data, searchQuery, filters, columns])

  // Find selected record from filtered data (or fallback to full data if not in filtered)
  const selectedRecord = useMemo(() => {
    if (!selectedRecordId) return null
    // First try to find in filtered data (what's actually displayed)
    const filtered = filteredData.find(record => record.id === selectedRecordId)
    if (filtered) return filtered
    // Fallback to full data if record exists but is filtered out
    return data.find(record => record.id === selectedRecordId) || null
  }, [selectedRecordId, filteredData, data])

  // Group records by configured group field (select field)
  const groupedRecords = useMemo(() => {
    const groups: Record<string, any[]> = {}
    
    if (!groupField) {
      // No group field configured - return all records in a single ungrouped list
      return { '': filteredData }
    }
    
    filteredData.forEach((record) => {
      const groupValue = record[groupField]
      // Handle null/undefined values
      const groupKey = groupValue !== null && groupValue !== undefined && groupValue !== '' 
        ? String(groupValue) 
        : 'No ' + groupField
      
      if (!groups[groupKey]) {
        groups[groupKey] = []
      }
      groups[groupKey].push(record)
    })
    
    return groups
  }, [filteredData, groupField])

  // CRITICAL: Auto-select first record if none selected (use filtered data, fallback to data)
  // Record Review must NEVER have null recordId - always select first record if available
  useEffect(() => {
    // Priority: filteredData first (what user sees), then fallback to data (all records)
    const recordsToCheck = filteredData.length > 0 ? filteredData : data
    
    if (!selectedRecordId && recordsToCheck.length > 0 && recordsToCheck[0]?.id) {
      const firstRecordId = recordsToCheck[0].id
      debugLog('RECORD', 'Auto-selecting first record', {
        recordId: firstRecordId,
        filteredDataLength: filteredData.length,
        dataLength: data.length,
        usingFilteredData: filteredData.length > 0,
      })
      setSelectedRecordId(firstRecordId)
    } else if (selectedRecordId) {
      // Check if selected record exists in filtered data
      const recordExists = filteredData.length > 0 
        ? filteredData.find(r => r.id === selectedRecordId)
        : data.find(r => r.id === selectedRecordId)
      
      // If selected record is filtered out, select first available from filtered data
      if (!recordExists && filteredData.length > 0) {
        const newRecordId = filteredData[0].id
        debugLog('RECORD', 'Selected record filtered out, selecting new record', {
          oldRecordId: selectedRecordId,
          newRecordId,
          filteredDataLength: filteredData.length,
        })
        setSelectedRecordId(newRecordId)
      }
      // CRITICAL: Do NOT set to null - keep previous selection if no records available
      // This ensures recordId is never null when passed to InterfaceBuilder
    }
    
    // DEBUG_RECORD: Log record selection state
    debugLog('RECORD', 'Record selection state', {
      selectedRecordId,
      filteredDataLength: filteredData.length,
      dataLength: data.length,
      blocksLength: loadedBlocks.length,
      blocksLoading,
      renderPath: selectedRecordId ? 'view' : 'setup',
    })
  }, [filteredData, data, selectedRecordId, loadedBlocks.length, blocksLoading, recordDebugEnabled])

  // Load table fields
  useEffect(() => {
    if (pageTableId) {
      debugLog('RECORD', 'Loading table fields', {
        pageTableId,
      })
      loadTableFields()
      loadFieldGroups()
    } else {
      debugWarn('RECORD', 'No pageTableId provided, cannot load fields', {
        pageId: page.id,
      })
    }
  }, [pageTableId])
  
  async function loadTableFields() {
    if (!pageTableId) return
    
    try {
      debugLog('RECORD', 'Fetching table fields', {
        pageTableId,
      })
      const supabase = createClient()
      const { data: fieldsData, error } = await supabase
        .from('table_fields')
        .select('*')
        .eq('table_id', pageTableId)
        .order('position', { ascending: true })
      
      if (error) {
        debugError('RECORD', 'Error loading table fields', {
          pageTableId,
          error: error.message,
        })
        console.error('Error loading table fields:', error)
        return
      }
      
      if (fieldsData) {
        debugLog('RECORD', 'Table fields loaded', {
          pageTableId,
          fieldsCount: fieldsData.length,
          fieldNames: fieldsData.map((f: any) => f.name),
        })
        setTableFields(fieldsData as TableField[])
      } else {
        debugWarn('RECORD', 'No fields returned', {
          pageTableId,
        })
      }
    } catch (error: any) {
      debugError('RECORD', 'Exception loading table fields', {
        pageTableId,
        error: error.message,
      })
      console.error('Error loading table fields:', error)
    }
  }

  async function loadFieldGroups() {
    if (!pageTableId) return
    
    try {
      debugLog('RECORD', 'Fetching field groups', {
        pageTableId,
      })
      const supabase = createClient()
      const { data: groupsData, error } = await supabase
        .from('field_groups')
        .select('*')
        .eq('table_id', pageTableId)
      
      if (error) {
        debugError('RECORD', 'Error loading field groups', {
          pageTableId,
          error: error.message,
        })
        console.error('Error loading field groups:', error)
        return
      }
      
      if (groupsData) {
        const groups: Record<string, string[]> = {}
        groupsData.forEach((group: any) => {
          if (group.field_names && Array.isArray(group.field_names)) {
            groups[group.name] = group.field_names
          }
        })
        debugLog('RECORD', 'Field groups loaded', {
          pageTableId,
          groupsCount: Object.keys(groups).length,
          groupNames: Object.keys(groups),
        })
        setFieldGroups(groups)
      }
    } catch (error: any) {
      debugError('RECORD', 'Exception loading field groups', {
        pageTableId,
        error: error.message,
      })
      console.error('Error loading field groups:', error)
    }
  }

  // Update formData when selected record changes
  useEffect(() => {
    if (selectedRecord) {
      debugLog('RECORD', 'Selected record changed', {
        recordId: selectedRecord.id,
        recordKeys: Object.keys(selectedRecord),
        hasBlocks: loadedBlocks.length > 0,
      })
      setFormData({ ...selectedRecord })
    } else {
      debugLog('RECORD', 'No record selected', {
        filteredDataLength: filteredData.length,
      })
      setFormData({})
    }
  }, [selectedRecord, loadedBlocks.length, filteredData.length, recordDebugEnabled])

  // Handle field changes
  const handleFieldChange = async (fieldName: string, value: any) => {
    if (!allowEditing || !selectedRecordId || !pageTableId) return

    setFormData(prev => ({ ...prev, [fieldName]: value }))

    try {
      const supabase = createClient()
      const { data: table } = await supabase
        .from('tables')
        .select('supabase_table')
        .eq('id', pageTableId)
        .single()

      if (!table?.supabase_table) return

      const { error } = await supabase
        .from(table.supabase_table)
        .update({ [fieldName]: value })
        .eq('id', selectedRecordId)

      if (error) throw error

      toast({
        title: 'Field updated',
        description: `${fieldName} has been updated`,
      })
    } catch (error: any) {
      console.error('Error updating field:', error)
      toast({
        variant: 'destructive',
        title: 'Failed to update field',
        description: error.message || 'Please try again',
      })
      // Revert formData on error
      if (selectedRecord) {
        setFormData({ ...selectedRecord })
      }
    }
  }

  // Get fields to display in left panel (filtered by config.detail_fields)
  const visibleFields = useMemo(() => {
    if (!tableFields.length) return []
    
    // Check if detail_fields is explicitly configured (not undefined/null/empty)
    const detailFields = config.detail_fields
    const hasDetailFieldsConfig = detailFields && Array.isArray(detailFields) && detailFields.length > 0
    
    // If detail_fields is explicitly configured with field names, filter to only those fields
    // (and filter out any that don't exist in the table anymore)
    if (hasDetailFieldsConfig) {
      return tableFields.filter(field => detailFields.includes(field.name))
    }
    
    // Otherwise (undefined, null, or empty array), show ALL fields from the table
    // This ensures new fields added to the table automatically appear
    return tableFields
  }, [tableFields, config.detail_fields])

  // CRITICAL: Memoize InterfaceBuilder page props to prevent remounts
  // Creating new objects on every render causes component remounts and canvas resets
  const recordReviewPage = useMemo(() => ({
    id: page.id,
    name: page.name,
    settings: { layout_template: 'record_review' as const },
    description: 'Record detail view'
  }), [page.id, page.name])

  // Load blocks for detail panel
  useEffect(() => {
    if (blocks.length === 0 && !blocksLoading) {
      loadBlocks()
    } else if (blocks.length > 0) {
      setLoadedBlocks(blocks)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page.id, blocks])

  async function loadBlocks() {
    debugLog('RECORD', 'Loading blocks', {
      pageId: page.id,
    })
    setBlocksLoading(true)
    try {
      const res = await fetch(`/api/pages/${page.id}/blocks`)
      if (!res.ok) {
        const errorText = await res.text()
        debugError('RECORD', 'Failed to load blocks', {
          pageId: page.id,
          status: res.status,
          statusText: res.statusText,
          errorText,
        })
        throw new Error('Failed to load blocks')
      }
      
      const data = await res.json()
      const pageBlocks = (data.blocks || []).map((block: any) => ({
        id: block.id,
        page_id: block.page_id || page.id,
        type: block.type,
        x: block.x || block.position_x || 0,
        y: block.y || block.position_y || 0,
        w: block.w || block.width || 4,
        h: block.h || block.height || 4,
        config: block.config || {},
        order_index: block.order_index || 0,
        created_at: block.created_at,
        updated_at: block.updated_at,
      }))
      
      debugLog('RECORD', 'Blocks loaded', {
        pageId: page.id,
        blocksCount: pageBlocks.length,
        blockIds: pageBlocks.map((b: PageBlock) => b.id),
        blockTypes: pageBlocks.map((b: PageBlock) => b.type),
      })
      setLoadedBlocks(pageBlocks)
    } catch (error: any) {
      debugError('RECORD', 'Exception loading blocks', {
        pageId: page.id,
        error: error.message,
      })
      console.error("Error loading blocks:", error)
      setLoadedBlocks([])
    } finally {
      setBlocksLoading(false)
    }
  }

  // Setup state: No table selected
  if (!pageTableId) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500 p-4">
        <div className="text-center max-w-md">
          <div className="text-sm mb-2 font-medium">Select a table to review records.</div>
          <div className="text-xs text-gray-400">This page isn&apos;t connected to a table. Please configure it in Settings.</div>
        </div>
      </div>
    )
  }

  // Get status colors
  const getStatusColor = (status: string) => {
    const statusLower = String(status).toLowerCase()
    if (statusLower.includes('new')) return 'bg-blue-100 text-blue-800 border-blue-200'
    if (statusLower.includes('progress')) return 'bg-yellow-100 text-yellow-800 border-yellow-200'
    if (statusLower.includes('done') || statusLower.includes('complete')) return 'bg-green-100 text-green-800 border-green-200'
    return 'bg-gray-100 text-gray-800 border-gray-200'
  }

  return (
    <div className="h-full flex bg-white">
      {/* Left Column - Record List + Record Fields */}
      <div className={recordPanel === 'side' ? 'w-96 border-r flex flex-col overflow-hidden bg-white' : 'w-full flex flex-col overflow-hidden'}>
        {/* Record List Section - Collapsible */}
        <div className="border-b bg-white">
          <button
            onClick={() => setRecordListCollapsed(!recordListCollapsed)}
            className="w-full px-4 py-2 flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <h2 className="text-sm font-semibold text-gray-900">Records</h2>
            {recordListCollapsed ? (
              <ChevronDown className="h-4 w-4 text-gray-500" />
            ) : (
              <ChevronUp className="h-4 w-4 text-gray-500" />
            )}
          </button>
          
          {!recordListCollapsed && (
            <>
              {/* Search */}
              <div className="px-4 pb-3">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="Search records..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 h-8 text-sm"
                  />
                </div>
              </div>

              {/* Records List - Grouped by Status */}
              <div className="max-h-64 overflow-auto border-t">
                {isLoading ? (
                  <div className="flex items-center justify-center py-8 text-gray-500 p-4">
                    <div className="text-center">
                      <p className="text-xs mb-1 font-medium">Loading...</p>
                    </div>
                  </div>
                ) : filteredData.length === 0 ? (
                  <div className="flex items-center justify-center py-8 text-gray-500 p-4">
                    <div className="text-center">
                      <p className="text-xs mb-1 font-medium">
                        {data.length === 0 ? 'No records' : 'No matches'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-2">
                    {Object.entries(groupedRecords).map(([groupValue, records]) => (
                      <div key={groupValue} className={groupField ? "mb-4" : ""}>
                        {/* Group Header - only show if grouping is enabled */}
                        {groupField && groupValue && (
                          <div className="flex items-center gap-2 mb-1 px-2">
                            <Badge className={cn('text-xs font-medium', getStatusColor(groupValue))}>
                              {groupValue}
                            </Badge>
                          </div>
                        )}
                        
                        {/* Records in this group */}
                        <div className="space-y-1">
                          {records.map((record) => {
                            const isSelected = record.id === selectedRecordId
                            
                            return (
                              <div
                                key={record.id}
                                onClick={() => {
                                  debugLog('RECORD', 'Record clicked', {
                                    recordId: record.id,
                                    recordData: Object.keys(record),
                                    hasBlocks: loadedBlocks.length > 0,
                                  })
                                  setSelectedRecordId(record.id)
                                }}
                                className={cn(
                                  'px-2 py-1.5 rounded-md cursor-pointer transition-colors text-xs',
                                  isSelected 
                                    ? 'bg-blue-50 border border-blue-200' 
                                    : 'hover:bg-gray-50 border border-transparent'
                                )}
                              >
                                {/* Render configured preview fields */}
                                {previewFields.length > 0 ? (
                                  <div className="space-y-0.5">
                                    {previewFields.map((fieldIdOrName: string, idx: number) => {
                                      const fieldValue = record[fieldIdOrName]
                                      const fieldDisplayName = getFieldDisplayName(fieldIdOrName)
                                      const isStatusField = fieldIdOrName.toLowerCase().includes('status') || 
                                                            fieldIdOrName.toLowerCase() === 'state' ||
                                                            fieldIdOrName.toLowerCase() === 'stage'
                                      
                                      return (
                                        <div key={fieldIdOrName} className={idx === 0 ? 'font-medium text-gray-900' : 'text-gray-600'}>
                                          {isStatusField && fieldValue ? (
                                            <Badge className={cn('text-xs', getStatusColor(String(fieldValue)))}>
                                              {String(fieldValue)}
                                            </Badge>
                                          ) : (
                                            <span>
                                              {fieldValue !== null && fieldValue !== undefined 
                                                ? String(fieldValue).substring(0, 30)
                                                : '—'}
                                              {fieldValue !== null && fieldValue !== undefined && String(fieldValue).length > 30 ? '...' : ''}
                                            </span>
                                          )}
                                        </div>
                                      )
                                    })}
                                  </div>
                                ) : (
                                  // Fallback: show name and status if no preview fields configured
                                  <>
                                    <div className="font-medium text-gray-900">
                                      {String(record[nameField] || record.id || 'Untitled').substring(0, 30)}
                                      {String(record[nameField] || record.id || 'Untitled').length > 30 ? '...' : ''}
                                    </div>
                                    {record[statusField] && (
                                      <Badge className={cn('text-xs mt-0.5', getStatusColor(String(record[statusField])))}>
                                        {record[statusField]}
                                      </Badge>
                                    )}
                                  </>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Record Fields Section */}
        <div className="flex-1 overflow-auto border-t">
          {!selectedRecordId ? (
            <div className="flex items-center justify-center h-full text-gray-400 text-sm p-4">
              <div className="text-center">
                <p className="text-xs mb-1 font-medium">Select a record</p>
                <p className="text-xs text-gray-400">Choose a record from the list above to view its fields.</p>
              </div>
            </div>
          ) : !selectedRecord ? (
            <div className="flex items-center justify-center h-full text-gray-400 text-sm p-4">
              <div className="text-center">
                <p className="text-xs mb-1 font-medium">Loading record...</p>
              </div>
            </div>
          ) : visibleFields.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-400 text-sm p-4">
              <div className="text-center">
                <p className="text-xs mb-1 font-medium">No fields configured</p>
                <p className="text-xs text-gray-400">Configure fields to display in Settings.</p>
              </div>
            </div>
          ) : (
            <div className="p-4">
              <RecordFields
                fields={visibleFields}
                formData={formData}
                onFieldChange={handleFieldChange}
                fieldGroups={fieldGroups}
                tableId={pageTableId || ''}
                recordId={selectedRecordId}
              />
            </div>
          )}
        </div>
      </div>

      {/* Detail panel - Right Column - Shows blocks for selected record */}
      {/* ALWAYS render the panel - never return null */}
      {recordPanel !== 'none' && (
        <div className={recordPanel === 'side' ? 'flex-1 border-r overflow-auto bg-white flex flex-col' : 'w-full border-t overflow-auto flex flex-col'}>
          {/* Edit Mode Toggle - Only show when record is selected */}
          {selectedRecordId && (
            <div className="border-b bg-gray-50 px-4 py-2 flex items-center justify-between">
              <div className="text-sm text-gray-600">
                {isEditing ? 'Editing panel layout' : 'View mode'}
              </div>
              <Button
                variant={isEditing ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  if (isEditing) {
                    exitBlockEdit()
                  } else {
                    enterBlockEdit()
                  }
                }}
                className="h-8"
              >
                <Edit2 className="h-4 w-4 mr-2" />
                {isEditing ? 'Done' : 'Edit Panel'}
              </Button>
            </div>
          )}
          
          <div className="flex-1 overflow-auto">
            {!selectedRecordId ? (
              // Setup state: No record selected
              <div className="flex items-center justify-center h-full text-gray-400 text-sm p-4">
                <div className="text-center">
                  <p className="mb-2 font-medium">Select a record to see details</p>
                  <p className="text-xs text-gray-400">Click on a record in the list to view its details.</p>
                </div>
              </div>
            ) : blocksLoading ? (
              // Loading state: Blocks are being loaded
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Loading blocks...</p>
                </div>
              </div>
            ) : (
              // Render blocks with record context - Always render something
              <div className="h-full">
                {loadedBlocks.length === 0 ? (
                  // Setup state: No blocks configured
                  <div className="flex items-center justify-center h-full text-gray-400 text-sm p-4">
                    <div className="text-center">
                      <p className="mb-2 font-medium">Add fields or blocks to design this view</p>
                      <p className="text-xs text-gray-400">
                        {isEditing 
                          ? "Click 'Edit Page' to add fields from Settings, or add blocks to customize the layout."
                          : "Click 'Edit Panel' above to add fields and blocks."}
                      </p>
                    </div>
                  </div>
                ) : (
                  // Render InterfaceBuilder with recordId
                  // Key ensures blocks re-render with new recordId when record changes
                  // Canvas preserves layout across remounts (layoutHydratedRef guards against resets)
                  // CRITICAL: Do NOT pass isViewer prop - let InterfaceBuilder use useBlockEditMode directly
                  // This ensures the right panel is editable exactly like Content pages
                  // Use memoized page object to prevent unnecessary remounts
                  <InterfaceBuilder
                    key={`record-${selectedRecordId}`}
                    page={recordReviewPage as any}
                    initialBlocks={loadedBlocks}
                    hideHeader={true}
                    pageTableId={pageTableId}
                    recordId={selectedRecordId}
                    onRecordClick={(recordId) => {
                      // CRITICAL: When calendar event is clicked, update selected record
                      // This allows calendar blocks in RecordReview to switch records
                      debugLog('RECORD', 'Calendar event clicked, switching record', {
                        recordId,
                        previousRecordId: selectedRecordId,
                        hasBlocks: loadedBlocks.length > 0,
                      })
                      setSelectedRecordId(recordId)
                    }}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Comments Sidebar - Right Column */}
      {recordPanel !== 'none' && showComments && (
        <div className="w-80 border-l flex flex-col overflow-hidden bg-white">
          <div className="border-b p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">All comments</h3>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                <ChevronDown className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          <div className="flex-1 overflow-auto p-4">
            <div className="flex flex-col items-center justify-center h-full text-gray-400 text-sm">
              <MessageSquare className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-xs text-center max-w-[200px]">
                Start a conversation. Ask questions and collaborate with your team.
              </p>
            </div>
          </div>
          
          <div className="border-t p-4">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-medium">
                S
              </div>
              <Input
                placeholder="Leave a comment"
                className="flex-1 h-8 text-sm"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

