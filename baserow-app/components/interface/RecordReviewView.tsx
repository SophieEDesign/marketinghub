'use client'

/**
 * Record Review View Component
 * Enables record switching with detail panel - no editing unless explicitly enabled
 */

import { useState } from 'react'
import { InterfacePage } from '@/lib/interface/pages'
import GridView from '@/components/grid/AirtableGridView'

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

  return (
    <div className="h-full flex">
      {/* Main list/grid view */}
      <div className={recordPanel === 'side' ? 'flex-1 border-r' : 'w-full'}>
        <GridView
          tableId={config.base_table || ''}
          viewId={page.id}
          rows={data}
          config={config}
          onRowClick={(recordId) => setSelectedRecordId(recordId)}
          selectedRowId={selectedRecordId}
        />
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

