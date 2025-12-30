'use client'

/**
 * Page Renderer Component
 * Renders pages based on page_type and config - no hardcoding
 */

import { InterfacePage } from '@/lib/interface/pages'
import { PageType } from '@/lib/interface/page-types'
import { useMemo } from 'react'
import dynamic from 'next/dynamic'

// Lazy load view components
const AirtableViewPage = dynamic(() => import('@/components/grid/AirtableViewPage'), { ssr: false })
const KanbanView = dynamic(() => import('@/components/kanban/KanbanView'), { ssr: false })
const CalendarView = dynamic(() => import('@/components/calendar/CalendarView'), { ssr: false })
const FormView = dynamic(() => import('@/components/form/FormView'), { ssr: false })
const InterfaceBuilder = dynamic(() => import('@/components/interface/InterfaceBuilder'), { ssr: false })
const RecordReviewView = dynamic(() => import('@/components/interface/RecordReviewView'), { ssr: false })

interface PageRendererProps {
  page: InterfacePage
  data?: any[] // Data from SQL view
  isLoading?: boolean
  onGridToggle?: () => void
  showGridToggle?: boolean
}

export default function PageRenderer({
  page,
  data = [],
  isLoading = false,
  onGridToggle,
  showGridToggle = false,
}: PageRendererProps) {
  const config = page.config || {}
  const visualisation = config.visualisation || page.page_type

  // Determine if grid toggle should be shown
  const shouldShowGridToggle = useMemo(() => {
    if (showGridToggle !== undefined) return showGridToggle
    const definition = require('@/lib/interface/page-types').PAGE_TYPE_DEFINITIONS[page.page_type]
    return definition?.supportsGridToggle ?? false
  }, [page.page_type, showGridToggle])

  // Render based on visualisation type (from config) or page_type (fallback)
  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-gray-500">Loading...</div>
        </div>
      )
    }

    switch (visualisation) {
      case 'list':
      case 'grid':
        // For list/grid views, we need to render using AirtableViewPage
        // This requires a view record, so we'll create a minimal one
        return (
          <div className="h-full">
            <SimpleGridView
              data={data}
              config={config}
              pageId={page.id}
            />
          </div>
        )

      case 'gallery':
        return (
          <div className="p-4">
            <GalleryView data={data} config={config} />
          </div>
        )

      case 'kanban':
        return (
          <KanbanView
            tableId={config.base_table || ''}
            viewId={page.id}
            groupingFieldId={config.group_by || ''}
            fieldIds={config.card_fields || []}
            data={data}
          />
        )

      case 'calendar':
        return (
          <CalendarView
            tableId={config.base_table || ''}
            viewId={page.id}
            dateFieldId={config.start_date_field || ''}
            endDateFieldId={config.end_date_field}
            data={data}
          />
        )

      case 'timeline':
        return (
          <div className="p-4">
            <TimelineView data={data} config={config} />
          </div>
        )

      case 'form':
        return (
          <FormView
            tableId={config.base_table || page.base_table || ''}
            viewId={page.id}
            fields={config.form_fields || []}
            submitAction={config.submit_action || 'create'}
          />
        )

      case 'dashboard':
        return (
          <div className="p-4">
            <DashboardView page={page} data={data} config={config} />
          </div>
        )

      case 'overview':
        return (
          <InterfaceBuilder
            page={{ id: page.id, name: page.name } as any}
            initialBlocks={[]}
            isViewer={false}
          />
        )

      case 'record_review':
        return (
          <RecordReviewView
            page={page}
            data={data}
            config={config}
          />
        )

      case 'blank':
      default:
        return (
          <div className="p-4">
            <BlankView />
          </div>
        )
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar with grid toggle if supported */}
      {shouldShowGridToggle && onGridToggle && (
        <div className="border-b px-4 py-2 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            {visualisation === 'grid' ? 'Grid view' : `${visualisation} view`}
          </div>
          <button
            onClick={onGridToggle}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            {visualisation === 'grid' ? 'Switch to list' : 'Switch to grid'}
          </button>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {renderContent()}
      </div>
    </div>
  )
}

// Placeholder components - these will be implemented
function GalleryView({ data, config }: { data: any[]; config: any }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {data.map((item, idx) => (
        <div key={idx} className="border rounded-lg p-4">
          {config.cover_field && item[config.cover_field] && (
            <img src={item[config.cover_field]} alt="" className="w-full h-32 object-cover rounded mb-2" />
          )}
          <h3 className="font-semibold">{item[config.title_field] || 'Untitled'}</h3>
        </div>
      ))}
    </div>
  )
}

function TimelineView({ data, config }: { data: any[]; config: any }) {
  return (
    <div className="space-y-4">
      {data.map((item, idx) => (
        <div key={idx} className="border-l-2 pl-4">
          <div className="text-sm text-gray-500">{item[config.start_date_field]}</div>
          <div className="font-semibold">{item[config.title_field] || 'Untitled'}</div>
        </div>
      ))}
    </div>
  )
}

function DashboardView({ page, data, config }: { page: InterfacePage; data: any[]; config: any }) {
  // Dashboard uses aggregation views
  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-500">Dashboard: {page.name}</div>
      {/* Dashboard blocks will be rendered here */}
    </div>
  )
}

function BlankView() {
  return (
    <div className="flex items-center justify-center h-full text-gray-400">
      Blank page
    </div>
  )
}

// Simple grid view for SQL view data
function SimpleGridView({ data, config, pageId }: { data: any[]; config: any; pageId: string }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        No data available
      </div>
    )
  }

  const columns = config.visible_columns || Object.keys(data[0] || {})

  return (
    <div className="h-full overflow-auto">
      <table className="w-full border-collapse">
        <thead className="bg-gray-50 sticky top-0">
          <tr>
            {columns.map((col: string) => (
              <th key={col} className="border p-2 text-left font-semibold">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => (
            <tr key={row.id || idx} className="hover:bg-gray-50">
              {columns.map((col: string) => (
                <td key={col} className="border p-2">
                  {row[col] !== null && row[col] !== undefined ? String(row[col]) : '-'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

