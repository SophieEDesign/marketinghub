'use client'

/**
 * Record Review View Component
 * Enables record switching with detail panel - no editing unless explicitly enabled
 */

import { useState } from 'react'
import type { InterfacePage } from '@/lib/interface/page-types-only'

interface RecordReviewViewProps {
  page: InterfacePage
  data: any[]
  config: any
}

export default function RecordReviewView({ page, data, config }: RecordReviewViewProps) {
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const allowEditing = config.allow_editing || false
  const recordPanel = config.record_panel || 'side'
  const detailFields = config.detail_fields || []

  const selectedRecord = data.find(record => record.id === selectedRecordId)

  // Get columns from config or data
  const columns = config.visible_columns || (data.length > 0 ? Object.keys(data[0]) : [])

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

      {/* Detail panel */}
      {recordPanel !== 'none' && selectedRecord && (
        <div className={recordPanel === 'side' ? 'w-96 border-l' : 'w-full border-t'}>
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Record Details</h3>
              {allowEditing && (
                <button
                  onClick={() => setIsEditing(!isEditing)}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  {isEditing ? 'Done' : 'Edit'}
                </button>
              )}
            </div>

            <div className="space-y-4">
              {detailFields.length > 0 ? (
                detailFields.map((field: string) => (
                  <div key={field}>
                    <div className="text-sm text-gray-500 mb-1">{field}</div>
                    <div className="text-sm">
                      {isEditing && allowEditing ? (
                        <input
                          type="text"
                          defaultValue={selectedRecord[field]}
                          className="w-full border rounded px-2 py-1"
                        />
                      ) : (
                        <div>{selectedRecord[field] || '-'}</div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                // Show all fields if detail_fields not specified
                Object.entries(selectedRecord).map(([key, value]) => (
                  <div key={key}>
                    <div className="text-sm text-gray-500 mb-1">{key}</div>
                    <div className="text-sm">
                      {isEditing && allowEditing ? (
                        <input
                          type="text"
                          defaultValue={String(value)}
                          className="w-full border rounded px-2 py-1"
                        />
                      ) : (
                        <div>{String(value) || '-'}</div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

