'use client'

/**
 * Record Review View Component
 * Master-detail layout: Left column shows record list, right panel shows blocks for selected record
 */

import { useState, useEffect } from 'react'
import type { InterfacePage } from '@/lib/interface/page-types-only'
import type { PageBlock } from '@/lib/interface/types'
import InterfaceBuilder from './InterfaceBuilder'
import { useBlockEditMode } from '@/contexts/EditModeContext'

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
  const { isEditing } = useBlockEditMode(page.id)
  
  const allowEditing = config.allow_editing || false
  const recordPanel = config.record_panel || 'side'
  const selectedRecord = data.find(record => record.id === selectedRecordId)

  // Get columns from config or data
  const columns = config.visible_columns || (data.length > 0 ? Object.keys(data[0]) : [])

  // Auto-select first record if none selected
  useEffect(() => {
    if (!selectedRecordId && data.length > 0) {
      setSelectedRecordId(data[0].id)
    }
  }, [data, selectedRecordId])

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

  return (
    <div className="h-full flex">
      {/* Main list/grid view */}
      <div className={recordPanel === 'side' ? 'flex-1 border-r overflow-auto' : 'w-full overflow-auto'}>
        {data.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            No records available
          </div>
        ) : (
          <div className="h-full overflow-auto">
            <table className="w-full border-collapse">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  {columns.map((col: string) => (
                    <th key={col} className="border p-2 text-left font-semibold text-sm">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((row, idx) => {
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
          </div>
        )}
      </div>

      {/* Detail panel - Shows blocks for selected record */}
      {recordPanel !== 'none' && (
        <div className={recordPanel === 'side' ? 'w-1/2 border-l overflow-auto' : 'w-full border-t overflow-auto'}>
          {!selectedRecord ? (
            <div className="flex items-center justify-center h-full text-gray-400 text-sm p-4">
              <div className="text-center">
                <p className="mb-2">No record selected</p>
                <p className="text-xs text-gray-400">Click on a record in the list to view details</p>
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
                <p className="mb-2">{isEditing ? "No blocks configured" : "No detail view configured"}</p>
                {isEditing && (
                  <p className="text-xs text-gray-400">Add blocks to customize the detail panel</p>
                )}
              </div>
            </div>
          ) : (
            <div className="h-full">
              {/* Render blocks with record context */}
              <InterfaceBuilder
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

