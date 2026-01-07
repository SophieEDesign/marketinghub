'use client'

/**
 * Page Renderer Component
 * Renders pages based on page_type and config - no hardcoding
 */

import type { InterfacePage } from '@/lib/interface/page-types-only'
import { PageType } from '@/lib/interface/page-types'
import type { ViewType } from '@/lib/interface/types'
import { useMemo, useState, useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'
import { getPageTableId } from '@/lib/interface/page-table-utils'
import { createClient } from '@/lib/supabase/client'
import GridView from '@/components/grid/GridView'
import { assertPageIsValid, shouldShowSetupUI } from '@/lib/interface/assertPageIsValid'
import { shouldShowSetupUIForDataWiring } from '@/lib/interface/data-wiring-guards'

// Lazy load view components
const AirtableViewPage = dynamic(() => import('@/components/grid/AirtableViewPage'), { ssr: false })
const FormView = dynamic(() => import('@/components/views/FormView'), { ssr: false })
const InterfaceBuilder = dynamic(() => import('@/components/interface/InterfaceBuilder'), { ssr: false })
const RecordReviewView = dynamic(() => import('@/components/interface/RecordReviewView'), { ssr: false })
const PageViewBlockWrapper = dynamic(() => import('./PageViewBlockWrapper'), { ssr: false })

interface PageRendererProps {
  page: InterfacePage
  data?: any[] // Data from SQL view
  isLoading?: boolean
  onGridToggle?: () => void
  showGridToggle?: boolean
  blocks?: any[] // Blocks for dashboard/overview/content pages
}

export default function PageRenderer({
  page,
  data = [],
  isLoading = false,
  onGridToggle,
  showGridToggle = false,
  blocks = [],
}: PageRendererProps) {
  const config = page.config || {}
  // For Record Review pages, always use 'record_review' as visualisation (ignore config)
  // Record Review pages are record-based, not view-based, so they shouldn't use view types
  const visualisation = page.page_type === 'record_review' 
    ? 'record_review' 
    : (config.visualisation || page.page_type)
  const [pageTableId, setPageTableId] = useState<string | null>(null)
  const prevPageIdRef = useRef<string>('')
  const prevBaseTableRef = useRef<string | null>(null)
  const prevSavedViewIdRef = useRef<string | null>(null)

  // Extract tableId from page - only update when relevant page properties change
  useEffect(() => {
    const pageId = page?.id || ''
    const baseTable = page?.base_table || null
    const savedViewId = page?.saved_view_id || null
    
    // Only run if page properties actually changed
    if (
      prevPageIdRef.current === pageId &&
      prevBaseTableRef.current === baseTable &&
      prevSavedViewIdRef.current === savedViewId
    ) {
      return
    }
    
    // Update refs
    prevPageIdRef.current = pageId
    prevBaseTableRef.current = baseTable
    prevSavedViewIdRef.current = savedViewId
    
    getPageTableId(page).then(tableId => {
      setPageTableId(prev => {
        // Only update if value actually changed
        if (prev !== tableId) {
          return tableId
        }
        return prev
      })
    })
  }, [page?.id, page?.base_table, page?.saved_view_id])

  // Determine if grid toggle should be shown
  // Record Review pages NEVER show grid toggle (fixed layout)
  const shouldShowGridToggle = useMemo(() => {
    if (page.page_type === 'record_review') return false // Record Review pages have fixed layout
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

    // Pre-deployment guard: Validate page before rendering
    const pageValidity = assertPageIsValid(page, {
      hasBlocks: blocks.length > 0,
      hasTableId: !!pageTableId,
      hasDateField: !!config.date_field || !!config.start_date_field, // Calendar pages
    })

    // Show setup UI if page is invalid
    if (shouldShowSetupUI(page, {
      hasBlocks: blocks.length > 0,
      hasTableId: !!pageTableId,
      hasDateField: !!config.date_field || !!config.start_date_field,
    })) {
      return <InvalidPageState page={page} reason={pageValidity.reason} />
    }

    // Check data wiring for pages that require it
    if (shouldShowSetupUIForDataWiring(
      !!pageTableId,
      !!page.saved_view_id,
      !!config.fields && config.fields.length > 0,
      page.page_type
    )) {
      return <InvalidPageState page={page} reason="Missing required data configuration" />
    }

    switch (visualisation) {
      case 'list':
      case 'grid':
      case 'kanban':
      case 'calendar':
      case 'timeline':
        // For data page views, use GridBlock to ensure unified rendering
        // This ensures they share the same renderer, settings schema, and data logic as blocks
        return (
          <PageViewBlockWrapper
            page={page}
            pageTableId={pageTableId}
            viewType={visualisation as ViewType}
            config={config}
            filters={[]}
          />
        )

      case 'gallery':
        // Gallery views use InterfaceBuilder with blocks
        return (
          <InterfaceBuilder
            page={{ 
              id: page.id, 
              name: page.name,
              settings: { layout_template: 'gallery', primary_table_id: pageTableId }
            } as any}
            initialBlocks={blocks}
            isViewer={true}
            hideHeader={true}
            pageTableId={pageTableId}
          />
        )

      case 'form':
        // FormView expects fieldIds as array of strings, not form_fields config
        // Get field IDs from config.form_fields or config.fields
        const formFieldIds = config.form_fields 
          ? config.form_fields.map((f: any) => typeof f === 'string' ? f : f.field_id || f.field_name)
          : config.fields || []
        
        if (!pageTableId) {
          // Show setup UI instead of dead-end message
          return (
            <div className="flex items-center justify-center h-full p-4">
              <div className="text-center max-w-md">
                <div className="flex justify-center mb-4">
                  <svg className="h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Connect a table
                </h3>
                <p className="text-sm text-gray-500 mb-6">
                  Form pages need a table connection. Select a table to configure form fields.
                </p>
                <button
                  onClick={() => {
                    // Trigger settings panel open via custom event
                    window.dispatchEvent(new CustomEvent('open-page-settings'))
                  }}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                >
                  <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Connect Table
                </button>
              </div>
            </div>
          )
        }
        
        // Use form_config_id or base_table for tableId, fallback to pageTableId
        const formTableId = page.form_config_id || page.base_table || pageTableId
        
        return (
          <FormView
            tableId={formTableId}
            viewId={page.saved_view_id || config.view_id || page.id}
            fieldIds={formFieldIds}
          />
        )

      case 'dashboard':
        return (
          <InterfaceBuilder
            page={{ 
              id: page.id, 
              name: page.name,
              settings: { layout_template: 'dashboard', primary_table_id: pageTableId }
            } as any}
            initialBlocks={blocks}
            isViewer={true}
            hideHeader={true}
            pageTableId={pageTableId}
          />
        )

      case 'overview':
        return (
          <InterfaceBuilder
            page={{ 
              id: page.id, 
              name: page.name,
              settings: { layout_template: 'overview', primary_table_id: pageTableId }
            } as any}
            initialBlocks={blocks}
            isViewer={true}
            hideHeader={true}
            pageTableId={pageTableId}
          />
        )
      
      case 'content':
        // Content pages render blocks only - show empty state if no blocks
        return (
          <div className="h-full">
            <InterfaceBuilder
              page={{ 
                id: page.id, 
                name: page.name,
                settings: { layout_template: 'content' },
                description: 'This is a content page. Add blocks to build your page.'
              } as any}
              initialBlocks={blocks}
              isViewer={true}
              hideHeader={true}
              pageTableId={null} // Content pages don't require tables
            />
          </div>
        )

      case 'record_review':
        if (!pageTableId) {
          // Show setup UI instead of dead-end message
          return (
            <div className="flex items-center justify-center h-full p-4">
              <div className="text-center max-w-md">
                <div className="flex justify-center mb-4">
                  <svg className="h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Connect a table
                </h3>
                <p className="text-sm text-gray-500 mb-6">
                  Record review pages need a table connection. Select a table to configure the detail panel.
                </p>
                <button
                  onClick={() => {
                    // Trigger settings panel open via custom event
                    window.dispatchEvent(new CustomEvent('open-page-settings'))
                  }}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                >
                  <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Connect Table
                </button>
              </div>
            </div>
          )
        }
        return (
          <RecordReviewView
            page={page}
            data={data}
            config={config}
            blocks={blocks}
            pageTableId={pageTableId}
            isLoading={isLoading}
          />
        )

      default:
        // Invalid page type or missing configuration
        return (
          <div className="p-4">
            <InvalidPageState page={page} />
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

function InvalidPageState({ page, reason }: { page: InterfacePage; reason?: string }) {
  return (
    <div className="flex items-center justify-center h-full p-4">
      <div className="text-center max-w-md">
        <div className="flex justify-center mb-4">
          <svg className="h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Page Configuration Required
        </h3>
        <p className="text-sm text-gray-500 mb-6">
          {reason || 'This page is missing required configuration. Configure it to get started.'}
        </p>
        <button
          onClick={() => {
            // Trigger settings panel open via custom event
            window.dispatchEvent(new CustomEvent('open-page-settings'))
          }}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
        >
          <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Configure Page
        </button>
      </div>
    </div>
  )
}

// List view grid component that loads view data
function ListViewGrid({ page, tableId, viewId, config }: { page: InterfacePage; tableId: string | null; viewId: string; config: any }) {
  const [viewFields, setViewFields] = useState<Array<{ field_name: string; visible: boolean; position: number }>>([])
  const [tableFields, setTableFields] = useState<any[]>([])
  const [viewFilters, setViewFilters] = useState<any[]>([])
  const [viewSorts, setViewSorts] = useState<any[]>([])
  const [supabaseTableName, setSupabaseTableName] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [groupBy, setGroupBy] = useState<string>('')

  useEffect(() => {
    loadViewData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewId, tableId])

  async function loadViewData() {
    if (!tableId || !viewId) {
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const supabase = createClient()

      // Load table to get supabase_table name
      const { data: table, error: tableError } = await supabase
        .from('tables')
        .select('supabase_table')
        .eq('id', tableId)
        .single()

      if (tableError || !table) {
        console.error('Error loading table:', tableError)
        setLoading(false)
        return
      }

      setSupabaseTableName(table.supabase_table)

      // Load view fields
      const { data: fieldsData } = await supabase
        .from('view_fields')
        .select('field_name, visible, position')
        .eq('view_id', viewId)
        .order('position', { ascending: true })

      setViewFields(fieldsData || [])

      // Load table fields
      const { data: tableFieldsData } = await supabase
        .from('table_fields')
        .select('*')
        .eq('table_id', tableId)
        .order('position', { ascending: true })

      setTableFields(tableFieldsData || [])

      // Load filters
      const { data: filtersData } = await supabase
        .from('view_filters')
        .select('*')
        .eq('view_id', viewId)

      setViewFilters(filtersData || [])

      // Load sorts
      const { data: sortsData } = await supabase
        .from('view_sorts')
        .select('*')
        .eq('view_id', viewId)
        .order('order_index', { ascending: true })

      setViewSorts(sortsData || [])

      // Load group by from config or grid_view_settings
      const groupByFromConfig = config?.group_by || ''
      if (groupByFromConfig) {
        setGroupBy(groupByFromConfig)
      } else {
        const { data: gridSettings } = await supabase
          .from('grid_view_settings')
          .select('group_by_field')
          .eq('view_id', viewId)
          .maybeSingle()

        if (gridSettings?.group_by_field) {
          setGroupBy(gridSettings.group_by_field)
        }
      }
    } catch (error) {
      console.error('Error loading view data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        Loading...
      </div>
    )
  }

  if (!supabaseTableName || !tableId) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        Table not found
      </div>
    )
  }

  return (
    <GridView
      tableId={tableId}
      viewId={viewId}
      supabaseTableName={supabaseTableName}
      viewFields={viewFields}
      viewFilters={viewFilters}
      viewSorts={viewSorts}
      groupBy={groupBy}
      tableFields={tableFields}
      isEditing={false}
    />
  )
}

// Simple grid view for SQL view data
function SimpleGridView({ data, config, pageId, tableId }: { data: any[]; config: any; pageId: string; tableId: string | null }) {
  if (!data || data.length === 0) {
    // Show setup UI instead of dead-end "No data available"
    return (
      <div className="flex items-center justify-center h-full p-4">
        <div className="text-center max-w-md">
          <div className="flex justify-center mb-4">
            <svg className="h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No data available
          </h3>
          <p className="text-sm text-gray-500 mb-6">
            This page is connected but has no data. Check your filters or add data to the table.
          </p>
          <button
            onClick={() => {
              // Trigger settings panel open via custom event
              window.dispatchEvent(new CustomEvent('open-page-settings'))
            }}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
          >
            <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Configure Filters
          </button>
        </div>
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

