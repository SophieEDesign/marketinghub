'use client'

/**
 * Record Review View Component
 * Master-detail layout: Left column shows record list with search/filters, right panel shows blocks for selected record
 */

import { useState, useEffect, useMemo } from 'react'
import { Search, Filter, List, Plus, ChevronDown, MessageSquare } from 'lucide-react'
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

interface RecordReviewViewProps {
  page: InterfacePage
  data: any[]
  config: any
  blocks?: PageBlock[]
  pageTableId: string | null // Table ID from the page
}

export default function RecordReviewView({ page, data, config, blocks = [], pageTableId }: RecordReviewViewProps) {
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null)
  const [loadedBlocks, setLoadedBlocks] = useState<PageBlock[]>(blocks)
  const [blocksLoading, setBlocksLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filters, setFilters] = useState<FilterConfig[]>(config.filters || [])
  const [tableFields, setTableFields] = useState<TableField[]>([])
  const { isEditing } = useBlockEditMode(page.id)
  
  const allowEditing = config.allow_editing || false
  const recordPanel = config.record_panel || 'side'
  const selectedRecord = data.find(record => record.id === selectedRecordId)
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
  
  // Get status field (look for common status field names)
  const statusField = columns.find((col: string) => 
    col.toLowerCase().includes('status') || 
    col.toLowerCase() === 'state' ||
    col.toLowerCase() === 'stage'
  ) || columns[0] // Fallback to first column
  
  // Get name/title field (look for common name field names)
  const nameField = columns.find((col: string) => 
    col.toLowerCase().includes('name') || 
    col.toLowerCase().includes('title') ||
    col.toLowerCase() === 'id'
  ) || columns[0] // Fallback to first column
  
  // Group records by status
  const groupedRecords = useMemo(() => {
    const groups: Record<string, any[]> = {}
    filteredData.forEach((record) => {
      const status = record[statusField] || 'No Status'
      if (!groups[status]) {
        groups[status] = []
      }
      groups[status].push(record)
    })
    return groups
  }, [filteredData, statusField])

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

  // Auto-select first record if none selected (use filtered data)
  useEffect(() => {
    if (!selectedRecordId && filteredData.length > 0) {
      setSelectedRecordId(filteredData[0].id)
    } else if (selectedRecordId && !filteredData.find(r => r.id === selectedRecordId)) {
      // If selected record is filtered out, select first available
      if (filteredData.length > 0) {
        setSelectedRecordId(filteredData[0].id)
      } else {
        setSelectedRecordId(null)
      }
    }
  }, [filteredData, selectedRecordId])

  // Load table fields
  useEffect(() => {
    if (pageTableId) {
      loadTableFields()
    }
  }, [pageTableId])
  
  async function loadTableFields() {
    if (!pageTableId) return
    
    try {
      const supabase = createClient()
      const { data: fieldsData, error } = await supabase
        .from('table_fields')
        .select('*')
        .eq('table_id', pageTableId)
        .order('position', { ascending: true })
      
      if (!error && fieldsData) {
        setTableFields(fieldsData as TableField[])
      }
    } catch (error) {
      console.error('Error loading table fields:', error)
    }
  }

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
    setBlocksLoading(true)
    try {
      const res = await fetch(`/api/pages/${page.id}/blocks`)
      if (!res.ok) throw new Error('Failed to load blocks')
      
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
      setLoadedBlocks(pageBlocks)
    } catch (error) {
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
      {/* Main list view - Left Column */}
      <div className={recordPanel === 'side' ? 'w-80 border-r flex flex-col overflow-hidden bg-white' : 'w-full flex flex-col overflow-hidden'}>
        {/* Header */}
        <div className="border-b bg-white p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900">{page.name || 'Records'}</h2>
            <Button size="sm" variant="outline" className="h-8">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Search and Icons */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-sm"
              />
            </div>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <List className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <span className="text-xs">1</span>
            </Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <Filter className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Records List - Grouped by Status */}
        <div className="flex-1 overflow-auto">
          {filteredData.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500 p-4">
              <div className="text-center">
                <p className="text-sm mb-2 font-medium">
                  {data.length === 0 ? 'No records available' : 'No records match your search'}
                </p>
                <p className="text-xs text-gray-400">
                  {data.length === 0 
                    ? "This table doesn't have any records yet."
                    : "Try adjusting your search or filters."
                  }
                </p>
              </div>
            </div>
          ) : (
            <div className="p-2">
              {Object.entries(groupedRecords).map(([status, records]) => (
                <div key={status} className="mb-6">
                  {/* Status Header */}
                  <div className="flex items-center gap-2 mb-2 px-2">
                    <Badge className={cn('text-xs font-medium', getStatusColor(status))}>
                      {status}
                    </Badge>
                  </div>
                  
                  {/* Records in this status */}
                  <div className="space-y-1">
                    {records.map((record) => {
                      const isSelected = record.id === selectedRecordId
                      const recordName = record[nameField] || record.id || 'Untitled'
                      const recordStatus = record[statusField] || 'No Status'
                      
                      return (
                        <div
                          key={record.id}
                          onClick={() => setSelectedRecordId(record.id)}
                          className={cn(
                            'px-3 py-2 rounded-md cursor-pointer transition-colors',
                            isSelected 
                              ? 'bg-blue-50 border border-blue-200' 
                              : 'hover:bg-gray-50 border border-transparent'
                          )}
                        >
                          <div className="font-medium text-sm text-gray-900 mb-1">
                            {String(recordName).substring(0, 50)}
                            {String(recordName).length > 50 ? '...' : ''}
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={cn('text-xs', getStatusColor(recordStatus))}>
                              {recordStatus}
                            </Badge>
                            <span className="text-xs text-gray-400">—</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Detail panel - Right Column - Shows blocks for selected record */}
      {recordPanel !== 'none' && (
        <div className={recordPanel === 'side' ? 'flex-1 border-r overflow-auto bg-white' : 'w-full border-t overflow-auto'}>
          {!selectedRecord ? (
            <div className="flex items-center justify-center h-full text-gray-400 text-sm p-4">
              <div className="text-center">
                <p className="mb-2 font-medium">Select a record to see details.</p>
                <p className="text-xs text-gray-400">Click on a record in the list to view its details.</p>
              </div>
            </div>
          ) : blocksLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2" />
                <p className="text-sm text-gray-500">Loading blocks...</p>
              </div>
            </div>
          ) : loadedBlocks.length === 0 ? (
            <div className="p-6">
              {/* Simple detail view when no blocks configured */}
              <div className="space-y-6">
                <div>
                  <h1 className="text-2xl font-semibold text-gray-900 mb-6">
                    {selectedRecord[nameField] || selectedRecord.id || 'Untitled'}
                  </h1>
                </div>
                
                {/* Basic Fields */}
                <div className="space-y-4">
                  {Array.isArray(columns) && columns.length > 0 ? columns.slice(0, 5).map((col: string) => {
                    const value = selectedRecord[col]
                    const isNotes = col.toLowerCase().includes('note') || col.toLowerCase().includes('description')
                    const fieldDisplayName = getFieldDisplayName(col)
                    
                    return (
                      <div key={col} className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">{fieldDisplayName}</label>
                        {isNotes ? (
                          <Textarea
                            value={value || ''}
                            readOnly={!allowEditing}
                            className="min-h-[120px]"
                          />
                        ) : col.toLowerCase().includes('status') ? (
                          <Select value={value || ''} disabled={!allowEditing}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.keys(groupedRecords).map((status) => (
                                <SelectItem key={status} value={status}>
                                  {status}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : col.toLowerCase().includes('assign') ? (
                          <Select value={value || ''} disabled={!allowEditing}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select assignee" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="unassigned">Unassigned</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input value={value || ''} readOnly={!allowEditing} />
                        )}
                      </div>
                    )
                  }) : (
                    <div className="text-sm text-gray-500">No fields available to display</div>
                  )}
                </div>
                
                {/* Action Buttons */}
                <div className="flex gap-2 pt-4 border-t">
                  <Button variant="outline" size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    Add content
                  </Button>
                  <Button variant="outline" size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    Add record
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full">
              {/* Render blocks with record context */}
              <InterfaceBuilder
                key={`record-${selectedRecordId || 'none'}`}
                page={{
                  id: page.id,
                  name: page.name,
                  settings: { layout_template: 'record_review' },
                  description: 'Record detail view'
                } as any}
                initialBlocks={loadedBlocks}
                isViewer={!isEditing}
                hideHeader={true}
                pageTableId={pageTableId}
                recordId={selectedRecordId || null}
              />
            </div>
          )}
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

