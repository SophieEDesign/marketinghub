'use client'

/**
 * Record Review View Component
 * Master-detail layout: Left column shows record list with search/filters, right panel shows blocks for selected record
 */

import { useState, useEffect, useMemo } from 'react'
import { Search, Filter } from 'lucide-react'
import type { InterfacePage } from '@/lib/interface/page-types-only'
import type { PageBlock } from '@/lib/interface/types'
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
  const { isEditing } = useBlockEditMode(page.id)
  
  const allowEditing = config.allow_editing || false
  const recordPanel = config.record_panel || 'side'
  const selectedRecord = data.find(record => record.id === selectedRecordId)

  // Get columns from config or data
  const columns = config.visible_columns || (data.length > 0 ? Object.keys(data[0]) : [])

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

  return (
    <div className="h-full flex">
      {/* Main list/grid view - Left Column */}
      <div className={recordPanel === 'side' ? 'flex-1 border-r flex flex-col overflow-hidden' : 'w-full flex flex-col overflow-hidden'}>
        {/* Search and Filter Bar */}
        <div className="border-b bg-white p-3 space-y-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search records..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {filters.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {filters.map((filter, idx) => (
                <div
                  key={idx}
                  className="px-2 py-1 bg-gray-100 border border-gray-300 rounded text-xs flex items-center gap-1"
                >
                  <span className="font-medium">{filter.field}</span>
                  <span className="text-gray-400">{filter.operator}</span>
                  <span className="text-gray-600">{String(filter.value || '')}</span>
                  <button
                    onClick={() => setFilters(filters.filter((_, i) => i !== idx))}
                    className="ml-1 text-gray-400 hover:text-gray-600"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Records List */}
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
            <table className="w-full border-collapse">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  {columns.map((col: string) => (
                    <th key={col} className="border p-2 text-left font-semibold text-sm">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredData.map((row, idx) => {
                  const isSelected = row.id === selectedRecordId
                  return (
                    <tr
                      key={row.id || idx}
                      onClick={() => setSelectedRecordId(row.id)}
                      className={`
                        hover:bg-gray-50 cursor-pointer transition-colors
                        ${isSelected ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''}
                      `}
                    >
                      {columns.map((col: string) => (
                        <td key={col} className="border p-2 text-sm">
                          {row[col] !== null && row[col] !== undefined ? String(row[col]) : '-'}
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Detail panel - Right Column - Shows blocks for selected record */}
      {recordPanel !== 'none' && (
        <div className={recordPanel === 'side' ? 'w-1/2 border-l overflow-auto' : 'w-full border-t overflow-auto'}>
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
            <div className="flex items-center justify-center h-full text-gray-400 text-sm p-4">
              <div className="text-center">
                <p className="mb-2 font-medium">{isEditing ? "No blocks configured" : "No detail view configured"}</p>
                {isEditing ? (
                  <p className="text-xs text-gray-400">Add blocks to design the record detail view.</p>
                ) : (
                  <p className="text-xs text-gray-400">Edit this page to add blocks and customize the detail view.</p>
                )}
              </div>
            </div>
          ) : (
            <div className="h-full">
              {/* Render blocks with record context - Layout does NOT reset when selecting new record */}
              {/* Key includes recordId to force re-render when record changes */}
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
    </div>
  )
}

